"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
function normalizeAmount(amount) {
    return Number(amount.toFixed(2));
}
async function main(event) {
    var _a, _b;
    const orderNo = (_a = event.orderNo) === null || _a === void 0 ? void 0 : _a.trim();
    if (!orderNo) {
        throw new Error('缺少订单号');
    }
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        throw new Error('用户未登录');
    }
    const oldOrder = await (0, db_1.getOrderByNo)(orderNo);
    if (!oldOrder) {
        throw new Error('订单不存在');
    }
    if (oldOrder.userId !== user._id) {
        throw new Error('无权操作该订单');
    }
    if (oldOrder.payStatus === 'paid') {
        throw new Error('订单已支付');
    }
    const plan = await (0, db_1.getPlanByCode)(oldOrder.planCode);
    if (!plan) {
        throw new Error('套餐不存在或已下架，请重新选择套餐');
    }
    const now = Date.now();
    await (0, db_1.collection)('orders').doc(oldOrder._id).update({
        data: {
            payStatus: 'closed',
            closedAt: now,
            closeReason: 'retry_order_created',
            updatedAt: now,
        },
    });
    const existingMembership = await (0, db_1.getMembershipByUserId)(user._id, plan.productCode);
    const availablePoints = Math.max(0, Math.floor((_b = user.pointsBalance) !== null && _b !== void 0 ? _b : 0));
    const maxDeductiblePoints = Math.floor(plan.price);
    const usePointsDeduction = Boolean(oldOrder.pointsDeductionEnabled);
    const pointsDeducted = usePointsDeduction ? Math.min(availablePoints, maxDeductiblePoints) : 0;
    const payableAmount = normalizeAmount(Math.max(0, plan.price - pointsDeducted));
    const nextOrder = {
        orderNo: (0, utils_1.createOrderNo)(),
        userId: user._id,
        productCode: plan.productCode,
        productName: plan.productName,
        planCode: plan.planCode,
        planName: plan.planName,
        orderType: existingMembership ? 'renew' : 'purchase',
        amount: payableAmount,
        originalAmount: normalizeAmount(plan.price),
        pointsDeductionEnabled: usePointsDeduction,
        pointsDeducted,
        pointsDeductAmount: pointsDeducted,
        durationDays: plan.durationDays,
        payStatus: 'pending',
        fulfillmentStatus: 'pending',
        payChannel: oldOrder.payChannel,
        createdAt: now,
        updatedAt: now,
    };
    await (0, db_1.collection)('orders').add({ data: nextOrder });
    return (0, utils_1.ok)({
        orderNo: nextOrder.orderNo,
        oldOrderNo: oldOrder.orderNo,
        amount: nextOrder.amount,
        originalAmount: nextOrder.originalAmount,
        pointsDeducted: nextOrder.pointsDeducted,
        pointsDeductAmount: nextOrder.pointsDeductAmount,
    });
}
