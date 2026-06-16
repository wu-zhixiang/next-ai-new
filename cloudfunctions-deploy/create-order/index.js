"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
const constants_1 = require("./shared/constants");
function normalizeAmount(amount) {
    return Number(amount.toFixed(2));
}
function isFirstBuyPlan(plan) {
    return normalizeBooleanFlag(plan.isFirstBuy);
}
function normalizeBooleanFlag(value) {
    if (value === true || value === 1) {
        return true;
    }
    if (typeof value === 'string') {
        return value.trim().toLowerCase() === 'true' || value.trim() === '1';
    }
    return false;
}
function normalizePurchasedProductCode(record) {
    return record.productCode || constants_1.DEFAULT_PRODUCT_CODE;
}
async function hasPurchasedProductBefore(userId, productCode) {
    const [memberships, orders] = await Promise.all([
        (0, db_1.listMembershipsByUserId)(userId),
        (0, db_1.listOrdersByUserId)(userId),
    ]);
    return memberships.some((membership) => normalizePurchasedProductCode(membership) === productCode)
        || orders.some((order) => normalizePurchasedProductCode(order) === productCode && order.payStatus === 'paid');
}
async function hasFirstBuyPlan(productCode) {
    const result = await (0, db_1.collection)('memberPlans')
        .where({ status: 'on', productCode })
        .get();
    return result.data.some(isFirstBuyPlan);
}
async function main(event) {
    var _a;
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        throw new Error('用户未登录');
    }
    if (!user.mobile) {
        throw new Error('请先完成手机号授权');
    }
    if (!event.pid) {
        throw new Error('套餐缺少 pid，请刷新后重试');
    }
    const plan = await (0, db_1.getPlanByPid)(event.pid);
    if (!plan) {
        throw new Error('套餐不存在或已下架');
    }
    const [existingMembership, purchasedBefore, firstBuyPlanExists] = await Promise.all([
        (0, db_1.getMembershipByUserId)(user._id, plan.productCode),
        hasPurchasedProductBefore(user._id, plan.productCode),
        hasFirstBuyPlan(plan.productCode),
    ]);
    const firstBuyPlan = isFirstBuyPlan(plan);
    if (purchasedBefore && firstBuyPlan) {
        console.warn(JSON.stringify({
            tag: 'create-order.first-buy-plan-blocked',
            userId: user._id,
            planCode: plan.planCode,
            productCode: plan.productCode,
            isFirstBuy: plan.isFirstBuy,
        }));
        throw new Error('该套餐仅限首次购买用户');
    }
    if (!purchasedBefore && firstBuyPlanExists && !firstBuyPlan) {
        throw new Error('首次购买请使用首次购买套餐');
    }
    const now = Date.now();
    const pendingOrders = await (0, db_1.listPendingOrdersByUserId)(user._id);
    await Promise.all(pendingOrders.map((pendingOrder) => (0, db_1.collection)('orders').doc(pendingOrder._id).update({
        data: {
            payStatus: 'closed',
            closedAt: now,
            closeReason: 'new_order_created',
            updatedAt: now,
        },
    })));
    const orderNo = (0, utils_1.createOrderNo)();
    const availablePoints = Math.max(0, Math.floor((_a = user.pointsBalance) !== null && _a !== void 0 ? _a : 0));
    const maxDeductiblePoints = Math.floor(plan.price);
    const pointsDeducted = event.usePointsDeduction ? Math.min(availablePoints, maxDeductiblePoints) : 0;
    const payableAmount = normalizeAmount(Math.max(0, plan.price - pointsDeducted));
    const order = {
        orderNo,
        userId: user._id,
        productCode: plan.productCode,
        productName: plan.productName,
        planCode: plan.planCode,
        planName: plan.planName,
        virtualPaymentProductId: plan.virtualPaymentProductId,
        orderType: purchasedBefore || existingMembership ? 'renew' : 'purchase',
        amount: payableAmount,
        originalAmount: normalizeAmount(plan.price),
        pointsDeductionEnabled: Boolean(event.usePointsDeduction),
        pointsDeducted,
        pointsDeductAmount: pointsDeducted,
        durationDays: plan.durationDays,
        payStatus: 'pending',
        fulfillmentStatus: 'pending',
        payChannel: 'wechat_virtual_pay',
        createdAt: now,
        updatedAt: now,
    };
    await (0, db_1.collection)('orders').add({ data: order });
    return (0, utils_1.ok)({
        orderNo,
        productCode: plan.productCode,
        productName: plan.productName,
        amount: payableAmount,
        originalAmount: normalizeAmount(plan.price),
        pointsDeducted,
        pointsDeductAmount: pointsDeducted,
        planName: plan.planName,
        durationDays: plan.durationDays,
    });
}
