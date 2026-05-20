"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
async function main() {
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        return (0, utils_1.ok)({ orders: [] });
    }
    const orders = await (0, db_1.listOrdersByUserId)(user._id);
    return (0, utils_1.ok)({
        orders: orders.map((order) => {
            var _a;
            const lastPayAttemptAt = order.prepayId ? order.updatedAt : undefined;
            return {
                orderNo: order.orderNo,
                productCode: order.productCode,
                productName: order.productName,
                planCode: order.planCode,
                planName: order.planName,
                amount: order.amount,
                originalAmount: order.originalAmount,
                pointsDeducted: order.pointsDeducted,
                pointsDeductAmount: order.pointsDeductAmount,
                durationDays: order.durationDays,
                payStatus: order.payStatus,
                fulfillmentStatus: (_a = order.fulfillmentStatus) !== null && _a !== void 0 ? _a : (order.payStatus === 'paid' ? 'fulfilled' : 'pending'),
                createdAt: order.createdAt,
                paidAt: order.paidAt,
                fulfilledAt: order.fulfilledAt,
                pendingExpireAt: order.payStatus === 'pending' ? (0, utils_1.getPendingOrderExpireAt)(order.createdAt, order.payExpireAt, lastPayAttemptAt) : undefined,
                canPay: order.payStatus === 'pending' && !(0, utils_1.isPendingOrderExpired)(order.createdAt, Date.now(), order.payExpireAt, lastPayAttemptAt),
            };
        }),
    });
}
