"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markOrderPaidAndOpenMembership = markOrderPaidAndOpenMembership;
const db_1 = require("./db");
const utils_1 = require("./utils");
function calcInviteRewardPoints(amount) {
    // 1 元 = 100 积分，邀请奖励为实付金额的 10%，测试 0.01 元订单至少返 1 积分，便于联调验收。
    return Math.max(1, Math.floor(amount * 100 * 0.1));
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
async function markOrderPaidAndOpenMembership(order, options = {}) {
    var _a, _b, _c, _d, _e;
    if (order.payStatus !== 'paid') {
        const paidAt = (_a = options.paidAt) !== null && _a !== void 0 ? _a : Date.now();
        await (0, db_1.collection)('orders').doc(order._id).update({
            data: {
                payStatus: 'paid',
                transactionId: (_c = (_b = options.transactionId) !== null && _b !== void 0 ? _b : order.transactionId) !== null && _c !== void 0 ? _c : '',
                paidAt,
                updatedAt: paidAt,
            },
        });
        const existingMembership = await (0, db_1.getMembershipByUserId)(order.userId, order.productCode);
        const startAt = existingMembership && existingMembership.endAt > paidAt ? existingMembership.endAt : paidAt;
        const endAt = startAt + order.durationDays * 24 * 60 * 60 * 1000;
        if (existingMembership) {
            await (0, db_1.collection)('memberships').doc(existingMembership._id).update({
                data: {
                    productCode: order.productCode,
                    productName: order.productName,
                    planCode: order.planCode,
                    planName: order.planName,
                    status: 'active',
                    startAt: existingMembership.startAt,
                    endAt,
                    remainDays: (0, utils_1.calcRemainDays)(endAt, paidAt),
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
                status: 'active',
                startAt: paidAt,
                endAt,
                remainDays: (0, utils_1.calcRemainDays)(endAt, paidAt),
                autoRenewStatus: 'off',
                createdAt: paidAt,
                updatedAt: paidAt,
            };
            await (0, db_1.collection)('memberships').add({ data: membership });
        }
    }
    await rewardInviterOnce(order, (_e = (_d = options.paidAt) !== null && _d !== void 0 ? _d : order.paidAt) !== null && _e !== void 0 ? _e : Date.now());
}
