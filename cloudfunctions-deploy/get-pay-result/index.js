"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
async function main(event) {
    var _a;
    const order = await (0, db_1.getOrderByNo)(event.orderNo);
    if (!order) {
        throw new Error('订单不存在');
    }
    const now = Date.now();
    const lastPayAttemptAt = order.prepayId ? order.updatedAt : undefined;
    const pendingExpireAt = (0, utils_1.getPendingOrderExpireAt)(order.createdAt, order.payExpireAt, lastPayAttemptAt);
    const pendingExpired = order.payStatus === 'pending' && (0, utils_1.isPendingOrderExpired)(order.createdAt, now, order.payExpireAt, lastPayAttemptAt);
    const payStatus = pendingExpired ? 'closed' : order.payStatus;
    if (pendingExpired) {
        await (0, db_1.collection)('orders').doc(order._id).update({
            data: {
                payStatus,
                closedAt: now,
                closeReason: 'pending_order_expired',
                updatedAt: now,
            },
        });
    }
    const membership = await (0, db_1.getMembershipByUserId)(order.userId, order.productCode);
    return (0, utils_1.ok)({
        orderNo: order.orderNo,
        productName: order.productName,
        planName: order.planName,
        amount: order.amount,
        createdAt: order.createdAt,
        payStatus,
        paidAt: order.paidAt,
        pendingExpireAt: order.payStatus === 'pending' || pendingExpired ? pendingExpireAt : undefined,
        canPay: payStatus === 'pending',
        membership: membership && membership.status === 'active'
            ? {
                status: 'active',
                startAt: membership.startAt,
                endAt: membership.endAt,
                remainDays: (_a = (0, utils_1.normalizeMembership)(membership).remainDays) !== null && _a !== void 0 ? _a : 0,
            }
            : undefined,
    });
}
