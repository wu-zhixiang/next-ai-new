"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
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
    const user = await (0, db_1.getUserById)(order.userId);
    if (!(user === null || user === void 0 ? void 0 : user.openid)) {
        throw new Error('订单用户缺少 openid，无法发起微信支付');
    }
    const payment = await (0, wechat_1.createWechatPayV2Order)(order, user.openid);
    await (0, db_1.collection)('orders').doc(order._id).update({
        data: {
            prepayId: payment.prepayId,
            updatedAt: Date.now(),
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
