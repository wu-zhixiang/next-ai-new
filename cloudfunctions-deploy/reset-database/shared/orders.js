"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markOrderPaidAndStartOpening = markOrderPaidAndStartOpening;
exports.fulfillPaidOrderMembership = fulfillPaidOrderMembership;
const db_1 = require("./db");
const operator_notify_1 = require("./operator-notify");
const utils_1 = require("./utils");
function calcInviteRewardPoints(amount) {
    // 1 积分 = 1 元；邀请奖励按被邀请人实付金额的 10% 向下取整。
    if (amount <= 0) {
        return 0;
    }
    return Math.floor(amount * 0.1);
}
async function deductPaymentPointsOnce(order, paidAt) {
    var _a;
    const points = Math.max(0, Math.floor((_a = order.pointsDeducted) !== null && _a !== void 0 ? _a : 0));
    if (points <= 0) {
        return;
    }
    const existing = await (0, db_1.collection)('pointsLedger')
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
            pointsBalance: db_1._.inc(-points),
            updatedAt: paidAt,
        },
    });
    const user = await (0, db_1.getUserById)(order.userId);
    const ledger = {
        userId: order.userId,
        orderNo: order.orderNo,
        type: 'payment_deduct',
        direction: 'out',
        points,
        balanceAfter: user === null || user === void 0 ? void 0 : user.pointsBalance,
        description: `订阅 ${order.planName} 抵扣积分`,
        createdAt: paidAt,
    };
    await (0, db_1.collection)('pointsLedger').add({ data: ledger });
    console.info('points.deduct.created', {
        orderNo: order.orderNo,
        userId: order.userId,
        points,
    });
}
async function rewardInviterOnce(order, paidAt) {
    const invitee = await (0, db_1.getUserById)(order.userId);
    if (!(invitee === null || invitee === void 0 ? void 0 : invitee.inviterUserId)) {
        console.info('invite.reward.skipped', {
            reason: 'inviter_missing',
            orderNo: order.orderNo,
            userId: order.userId,
        });
        return;
    }
    const existing = await (0, db_1.collection)('pointsLedger')
        .where({
        type: 'invite_reward',
        orderNo: order.orderNo,
        userId: invitee.inviterUserId,
    })
        .limit(1)
        .get();
    if (existing.data[0]) {
        console.info('invite.reward.skipped', {
            reason: 'ledger_exists',
            orderNo: order.orderNo,
            inviterUserId: invitee.inviterUserId,
        });
        return;
    }
    const rewardPoints = calcInviteRewardPoints(order.amount);
    if (rewardPoints <= 0) {
        console.info('invite.reward.skipped', {
            reason: 'zero_paid_amount',
            orderNo: order.orderNo,
            inviterUserId: invitee.inviterUserId,
        });
        return;
    }
    await (0, db_1.collection)('users').doc(invitee.inviterUserId).update({
        data: {
            pointsBalance: db_1._.inc(rewardPoints),
            updatedAt: paidAt,
        },
    });
    const inviter = await (0, db_1.getUserById)(invitee.inviterUserId);
    const ledger = {
        userId: invitee.inviterUserId,
        relatedUserId: order.userId,
        orderNo: order.orderNo,
        type: 'invite_reward',
        direction: 'in',
        points: rewardPoints,
        balanceAfter: inviter === null || inviter === void 0 ? void 0 : inviter.pointsBalance,
        description: `邀请用户订阅 ${order.planName} 返还积分`,
        createdAt: paidAt,
    };
    await (0, db_1.collection)('pointsLedger').add({ data: ledger });
    console.info('invite.reward.created', {
        orderNo: order.orderNo,
        inviterUserId: invitee.inviterUserId,
        inviteeUserId: order.userId,
        points: rewardPoints,
    });
}
async function markOrderPaidAndStartOpening(order, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (order.payStatus !== 'paid') {
        const paidAt = (_a = options.paidAt) !== null && _a !== void 0 ? _a : Date.now();
        await (0, db_1.collection)('orders').doc(order._id).update({
            data: {
                payStatus: 'paid',
                fulfillmentStatus: 'opening',
                transactionId: (_c = (_b = options.transactionId) !== null && _b !== void 0 ? _b : order.transactionId) !== null && _c !== void 0 ? _c : '',
                paidAt,
                updatedAt: paidAt,
            },
        });
        const existingMembership = await (0, db_1.getMembershipByUserId)(order.userId, order.productCode);
        const startAt = (_d = existingMembership === null || existingMembership === void 0 ? void 0 : existingMembership.startAt) !== null && _d !== void 0 ? _d : paidAt;
        const endAt = (_e = existingMembership === null || existingMembership === void 0 ? void 0 : existingMembership.endAt) !== null && _e !== void 0 ? _e : paidAt;
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
    const finalizedAt = (_g = (_f = options.paidAt) !== null && _f !== void 0 ? _f : order.paidAt) !== null && _g !== void 0 ? _g : Date.now();
    await deductPaymentPointsOnce(order, finalizedAt);
    await rewardInviterOnce(order, finalizedAt);
    await (0, operator_notify_1.notifyOperatorPaidOrderOnce)({
        ...order,
        payStatus: 'paid',
        fulfillmentStatus: 'opening',
        transactionId: (_h = options.transactionId) !== null && _h !== void 0 ? _h : order.transactionId,
        paidAt: finalizedAt,
    });
}
async function fulfillPaidOrderMembership(order, options = {}) {
    var _a;
    if (order.payStatus !== 'paid') {
        throw new Error('订单未支付，不能确认开通');
    }
    if (order.fulfillmentStatus === 'fulfilled') {
        return;
    }
    const fulfilledAt = (_a = options.fulfilledAt) !== null && _a !== void 0 ? _a : Date.now();
    const existingMembership = await (0, db_1.getMembershipByUserId)(order.userId, order.productCode);
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
}
