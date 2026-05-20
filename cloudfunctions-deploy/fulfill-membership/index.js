"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const orders_1 = require("./shared/orders");
const utils_1 = require("./shared/utils");
async function main(event) {
    var _a;
    const orderNo = (_a = event.orderNo) === null || _a === void 0 ? void 0 : _a.trim();
    if (!orderNo) {
        throw new Error('缺少订单号');
    }
    const order = await (0, db_1.getOrderByNo)(orderNo);
    if (!order) {
        throw new Error('订单不存在');
    }
    await (0, orders_1.fulfillPaidOrderMembership)(order, {
        fulfilledAt: event.fulfilledAt,
    });
    return (0, utils_1.ok)({
        success: true,
        orderNo: order.orderNo,
    });
}
