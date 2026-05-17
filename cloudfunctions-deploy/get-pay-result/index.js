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
    const membership = await (0, db_1.getMembershipByUserId)(order.userId, order.productCode);
    return (0, utils_1.ok)({
        orderNo: order.orderNo,
        payStatus: order.payStatus,
        paidAt: order.paidAt,
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
