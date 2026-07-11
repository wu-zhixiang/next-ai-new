"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markOrderPaidAndStartOpening = markOrderPaidAndStartOpening;
exports.fulfillPaidOrderMembership = fulfillPaidOrderMembership;
const db_1 = require("./db");
const member_reminders_1 = require("./member-reminders");
const operator_notify_1 = require("./operator-notify");
const utils_1 = require("./utils");
const ai_tool_entitlements_1 = require("./ai-tool-entitlements");
async function deductPaymentPointsOnce(order, paidAt) {
    var _a, _b;
    const points = Math.max(0, Math.floor((_a = order.pointsDeducted) !== null && _a !== void 0 ? _a : 0));
    if (points <= 0) {
        return;
    }
    if (order.orderType !== 'tool_single' && Math.max(0, Math.floor((_b = order.totalAiPoints) !== null && _b !== void 0 ? _b : 0)) <= 0) {
        return;
    }
    await (0, db_1.ensureCollection)('aiToolPointsLedger');
    const existing = await (0, db_1.collection)('aiToolPointsLedger')
        .where({
        type: 'payment_deduct',
        orderNo: order.orderNo,
        userId: order.userId,
    })
        .limit(1)
        .get();
    if (existing.data[0]) {
        console.info('points.deduct.skipped', {
            reason: 'ledger_exists',
            orderNo: order.orderNo,
            userId: order.userId,
        });
        return;
    }
    await (0, db_1.collection)('users').doc(order.userId).update({
        data: {
            aiToolPointsBalance: db_1._.inc(-points),
            updatedAt: paidAt,
        },
    });
    const user = await (0, db_1.getUserById)(order.userId);
    const ledger = {
        userId: order.userId,
        openid: user === null || user === void 0 ? void 0 : user.openid,
        orderNo: order.orderNo,
        type: 'payment_deduct',
        direction: 'out',
        points,
        balanceAfter: user === null || user === void 0 ? void 0 : user.aiToolPointsBalance,
        description: `${order.planName}抵扣${points}AI工具积分`,
        createdAt: paidAt,
    };
    await (0, db_1.collection)('aiToolPointsLedger').add({ data: ledger });
    console.info('points.deduct.created', {
        orderNo: order.orderNo,
        userId: order.userId,
        points,
    });
}
async function markOrderPaidAndStartOpening(order, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
    if (order.orderType === 'tool_single') {
        const paidAt = (_b = (_a = options.paidAt) !== null && _a !== void 0 ? _a : order.paidAt) !== null && _b !== void 0 ? _b : Date.now();
        if (order.payStatus !== 'paid') {
            await (0, db_1.collection)('orders').doc(order._id).update({
                data: {
                    payStatus: 'paid',
                    fulfillmentStatus: 'fulfilled',
                    transactionId: (_d = (_c = options.transactionId) !== null && _c !== void 0 ? _c : order.transactionId) !== null && _d !== void 0 ? _d : '',
                    paidAt,
                    fulfilledAt: paidAt,
                    updatedAt: paidAt,
                },
            });
        }
        await deductPaymentPointsOnce(order, paidAt);
        await (0, ai_tool_entitlements_1.grantSingleToolEntitlementOnce)(order, paidAt);
        return;
    }
    if (order.payStatus !== 'paid') {
        const paidAt = (_e = options.paidAt) !== null && _e !== void 0 ? _e : Date.now();
        await (0, db_1.collection)('orders').doc(order._id).update({
            data: {
                payStatus: 'paid',
                fulfillmentStatus: 'opening',
                transactionId: (_g = (_f = options.transactionId) !== null && _f !== void 0 ? _f : order.transactionId) !== null && _g !== void 0 ? _g : '',
                paidAt,
                updatedAt: paidAt,
            },
        });
        const existingMembership = await (0, db_1.getMembershipByUserId)(order.userId, order.productCode);
        const startAt = (_h = existingMembership === null || existingMembership === void 0 ? void 0 : existingMembership.startAt) !== null && _h !== void 0 ? _h : paidAt;
        const endAt = (_j = existingMembership === null || existingMembership === void 0 ? void 0 : existingMembership.endAt) !== null && _j !== void 0 ? _j : paidAt;
        if (existingMembership) {
            await (0, db_1.collection)('memberships').doc(existingMembership._id).update({
                data: {
                    productCode: order.productCode,
                    productName: order.productName,
                    planCode: order.planCode,
                    planName: order.planName,
                    status: 'opening',
                    startAt,
                    endAt,
                    remainDays: existingMembership.status === 'active' ? (0, utils_1.calcMembershipRemainDays)(existingMembership, paidAt) : 0,
                    updatedAt: paidAt,
                },
            });
        }
        else {
            const membership = {
                userId: order.userId,
                productCode: order.productCode,
                productName: order.productName,
                planCode: order.planCode,
                planName: order.planName,
                status: 'opening',
                startAt: paidAt,
                endAt: paidAt,
                remainDays: 0,
                autoRenewStatus: 'off',
                createdAt: paidAt,
                updatedAt: paidAt,
            };
            await (0, db_1.collection)('memberships').add({ data: membership });
        }
    }
    const finalizedAt = (_l = (_k = options.paidAt) !== null && _k !== void 0 ? _k : order.paidAt) !== null && _l !== void 0 ? _l : Date.now();
    await deductPaymentPointsOnce(order, finalizedAt);
    await (0, ai_tool_entitlements_1.grantAiToolPlanPointsOnce)(order, finalizedAt);
    await (0, ai_tool_entitlements_1.grantSingleToolEntitlementOnce)(order, finalizedAt);
    await (0, operator_notify_1.notifyOperatorPaidOrderOnce)({
        ...order,
        payStatus: 'paid',
        fulfillmentStatus: 'opening',
        transactionId: (_m = options.transactionId) !== null && _m !== void 0 ? _m : order.transactionId,
        paidAt: finalizedAt,
    });
}
async function fulfillPaidOrderMembership(order, options = {}) {
    var _a, _b;
    if (order.payStatus !== 'paid') {
        throw new Error('订单未支付，不能确认开通');
    }
    const existingMembership = await (0, db_1.getMembershipByUserId)(order.userId, order.productCode);
    if (order.fulfillmentStatus === 'fulfilled' && existingMembership) {
        return;
    }
    const fulfilledAt = (_b = (_a = options.fulfilledAt) !== null && _a !== void 0 ? _a : order.fulfilledAt) !== null && _b !== void 0 ? _b : Date.now();
    const startAt = existingMembership && existingMembership.status === 'active' && existingMembership.endAt > fulfilledAt
        ? existingMembership.endAt
        : fulfilledAt;
    const endAt = startAt + order.durationDays * 24 * 60 * 60 * 1000;
    if (existingMembership) {
        await (0, db_1.collection)('memberships').doc(existingMembership._id).update({
            data: {
                productCode: order.productCode,
                productName: order.productName,
                planCode: order.planCode,
                planName: order.planName,
                status: 'active',
                startAt,
                endAt,
                remainDays: (0, utils_1.calcMembershipRemainDays)({ endAt, planCode: order.planCode }, fulfilledAt),
                updatedAt: fulfilledAt,
            },
        });
    }
    else {
        const membership = {
            userId: order.userId,
            productCode: order.productCode,
            productName: order.productName,
            planCode: order.planCode,
            planName: order.planName,
            status: 'active',
            startAt,
            endAt,
            remainDays: (0, utils_1.calcMembershipRemainDays)({ endAt, planCode: order.planCode }, fulfilledAt),
            autoRenewStatus: 'off',
            createdAt: fulfilledAt,
            updatedAt: fulfilledAt,
        };
        await (0, db_1.collection)('memberships').add({ data: membership });
    }
    await (0, db_1.collection)('orders').doc(order._id).update({
        data: {
            fulfillmentStatus: 'fulfilled',
            fulfilledAt,
            updatedAt: fulfilledAt,
        },
    });
    try {
        await (0, member_reminders_1.sendMembershipOpenedReminder)(order, {
            endAt,
            createdAt: fulfilledAt,
        });
    }
    catch (error) {
        console.warn('membership.opened.reminder.failed', {
            orderNo: order.orderNo,
            message: error instanceof Error ? error.message : String(error),
        });
    }
}
