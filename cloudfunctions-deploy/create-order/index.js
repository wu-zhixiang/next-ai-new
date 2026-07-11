"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
const constants_1 = require("./shared/constants");
const client_config_1 = require("./shared/client-config");
const payment_config_1 = require("./shared/payment-config");
const points_config_1 = require("./shared/points-config");
const points_rewards_1 = require("./shared/points-rewards");
function normalizeAmount(amount) {
    return Number(amount.toFixed(2));
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
async function main(event) {
    var _a, _b, _c;
    const { OPENID } = (0, context_1.getWxContext)();
    const rawUser = await (0, db_1.getUserByOpenId)(OPENID);
    if (!rawUser) {
        throw new Error('用户未登录');
    }
    const user = await (0, points_rewards_1.migrateLegacyPointsBalanceToAiToolPoints)(rawUser);
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
    const [existingMembership, purchasedBefore, appConfig, pointsConfig] = await Promise.all([
        (0, db_1.getMembershipByUserId)(user._id, plan.productCode),
        hasPurchasedProductBefore(user._id, plan.productCode),
        (0, client_config_1.getClientAppConfig)(),
        (0, points_config_1.getPointsConfig)(),
    ]);
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
    const aiToolPointPlan = Math.max(0, Math.floor((_a = plan.totalAiPoints) !== null && _a !== void 0 ? _a : 0)) > 0;
    const availablePoints = Math.max(0, Math.floor((_b = user.aiToolPointsBalance) !== null && _b !== void 0 ? _b : 0));
    const deduction = (0, points_config_1.calculatePointsDeduction)({
        price: plan.price,
        availablePoints,
        usePointsDeduction: aiToolPointPlan && Boolean(event.usePointsDeduction),
        pointsPerYuan: pointsConfig.pointsPerYuan,
    });
    const order = {
        orderNo,
        userId: user._id,
        productCode: plan.productCode,
        productName: plan.productName,
        planCode: plan.planCode,
        planName: plan.planName,
        virtualPaymentProductId: plan.virtualPaymentProductId,
        orderType: purchasedBefore || existingMembership ? 'renew' : 'purchase',
        amount: deduction.payableAmount,
        originalAmount: normalizeAmount(plan.price),
        totalAiPoints: Math.max(0, Math.floor((_c = plan.totalAiPoints) !== null && _c !== void 0 ? _c : 0)),
        pointsDeductionEnabled: aiToolPointPlan && Boolean(event.usePointsDeduction),
        pointsDeducted: deduction.pointsDeducted,
        pointsDeductAmount: deduction.pointsDeductAmount,
        durationDays: plan.durationDays,
        payStatus: 'pending',
        fulfillmentStatus: 'pending',
        payChannel: (0, payment_config_1.paymentTypeToPayChannel)(appConfig.paymentType),
        createdAt: now,
        updatedAt: now,
    };
    await (0, db_1.collection)('orders').add({ data: order });
    return (0, utils_1.ok)({
        orderNo,
        productCode: plan.productCode,
        productName: plan.productName,
        amount: deduction.payableAmount,
        originalAmount: normalizeAmount(plan.price),
        pointsDeducted: deduction.pointsDeducted,
        pointsDeductAmount: deduction.pointsDeductAmount,
        planName: plan.planName,
        durationDays: plan.durationDays,
    });
}
