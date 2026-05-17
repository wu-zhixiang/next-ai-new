"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const orders_1 = require("./shared/orders");
const wechat_1 = require("./shared/wechat");
const utils_1 = require("./shared/utils");
async function main(event) {
    const order = await (0, db_1.getOrderByNo)(event.orderNo);
    if (!order) {
        throw new Error('订单不存在');
    }
    if (order.payStatus !== 'pending') {
        throw new Error('订单状态不可支付');
    }
    const lastPayAttemptAt = order.prepayId ? order.updatedAt : undefined;
    if ((0, utils_1.isPendingOrderExpired)(order.createdAt, Date.now(), order.payExpireAt, lastPayAttemptAt)) {
        const now = Date.now();
        await (0, db_1.collection)('orders').doc(order._id).update({
            data: {
                payStatus: 'closed',
                closedAt: now,
                closeReason: 'pending_order_expired',
                updatedAt: now,
            },
        });
        throw new Error('订单已超过 30 分钟有效期，请重新下单');
    }
    const user = await (0, db_1.getUserById)(order.userId);
    if (!(user === null || user === void 0 ? void 0 : user.openid)) {
        throw new Error('订单用户缺少 openid，无法发起微信支付');
    }
    let payment;
    try {
        payment = await (0, wechat_1.createWechatPayV2Order)(order, user.openid);
    }
    catch (error) {
        if (error instanceof wechat_1.WechatPayV2OrderError && error.errCode === 'ORDERPAID') {
            await (0, orders_1.markOrderPaidAndOpenMembership)(order);
            return (0, utils_1.ok)({
                orderNo: order.orderNo,
                paid: true,
                message: '订单已支付，已同步会员状态',
            });
        }
        throw error;
    }
    const now = Date.now();
    await (0, db_1.collection)('orders').doc(order._id).update({
        data: {
            prepayId: payment.prepayId,
            payExpireAt: (0, utils_1.getPendingOrderExpireAt)(now),
            updatedAt: now,
        },
    });
    return (0, utils_1.ok)({
        orderNo: order.orderNo,
        payment: {
            timeStamp: payment.timeStamp,
            nonceStr: payment.nonceStr,
            package: payment.package,
            signType: payment.signType,
            paySign: payment.paySign,
        },
    });
}
