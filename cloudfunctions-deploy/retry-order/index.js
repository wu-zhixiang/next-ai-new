"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
const client_config_1 = require("./shared/client-config");
const payment_config_1 = require("./shared/payment-config");
const points_config_1 = require("./shared/points-config");
const ai_tool_entitlements_1 = require("./shared/ai-tool-entitlements");
function normalizeAmount(amount) {
    return Number(amount.toFixed(2));
}
function getToolSingleVirtualPaymentProductId(toolId) {
    const toolKey = toolId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    return process.env[`WX_VIRTUAL_PAY_PRODUCT_ID_TOOL_SINGLE_${toolKey}`]
        || process.env.WX_VIRTUAL_PAY_PRODUCT_ID_TOOL_SINGLE
        || process.env.WX_VIRTUAL_PAY_PRODUCT_ID_AI_TOOL_SINGLE;
}
async function main(event) {
    var _a, _b, _c;
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
    if (oldOrder.orderType === 'tool_single') {
        const toolId = oldOrder.toolId || '';
        const tool = toolId ? await (0, ai_tool_entitlements_1.getEffectiveAiToolConfig)(toolId) : null;
        if (!tool) {
            throw new Error('工具不存在');
        }
        if (!tool.enabled) {
            throw new Error('该工具正在接入中');
        }
        const appConfig = await (0, client_config_1.getClientAppConfig)();
        const now = Date.now();
        await (0, db_1.collection)('orders').doc(oldOrder._id).update({
            data: {
                payStatus: 'closed',
                closedAt: now,
                closeReason: 'retry_order_created',
                updatedAt: now,
            },
        });
        const amount = normalizeAmount(tool.pointCost / 10);
        const nextOrder = {
            orderNo: (0, utils_1.createOrderNo)('TOOL'),
            userId: user._id,
            productCode: oldOrder.productCode || 'ai_tool_single',
            productName: oldOrder.productName || 'AI工具单次购买',
            planCode: `tool_single_${tool.toolId}`,
            planName: `${tool.name}单次使用`,
            virtualPaymentProductId: getToolSingleVirtualPaymentProductId(tool.toolId),
            orderType: 'tool_single',
            amount,
            originalAmount: amount,
            toolId: tool.toolId,
            toolName: tool.name,
            toolPointCost: tool.pointCost,
            durationDays: 0,
            payStatus: 'pending',
            fulfillmentStatus: 'pending',
            payChannel: (0, payment_config_1.paymentTypeToPayChannel)(appConfig.paymentType),
            createdAt: now,
            updatedAt: now,
        };
        await (0, db_1.collection)('orders').add({ data: nextOrder });
        return (0, utils_1.ok)({
            orderNo: nextOrder.orderNo,
            oldOrderNo: oldOrder.orderNo,
            amount: nextOrder.amount,
            originalAmount: nextOrder.originalAmount,
        });
    }
    const plan = await (0, db_1.getPlanByCode)(oldOrder.planCode);
    if (!plan) {
        throw new Error('套餐不存在或已下架，请重新选择套餐');
    }
    const [existingMembership, appConfig, pointsConfig] = await Promise.all([
        (0, db_1.getMembershipByUserId)(user._id, plan.productCode),
        (0, client_config_1.getClientAppConfig)(),
        (0, points_config_1.getPointsConfig)(),
    ]);
    const now = Date.now();
    await (0, db_1.collection)('orders').doc(oldOrder._id).update({
        data: {
            payStatus: 'closed',
            closedAt: now,
            closeReason: 'retry_order_created',
            updatedAt: now,
        },
    });
    const availablePoints = Math.max(0, Math.floor((_b = user.pointsBalance) !== null && _b !== void 0 ? _b : 0));
    const usePointsDeduction = Boolean(oldOrder.pointsDeductionEnabled);
    const deduction = (0, points_config_1.calculatePointsDeduction)({
        price: plan.price,
        availablePoints,
        usePointsDeduction,
        pointsPerYuan: pointsConfig.pointsPerYuan,
    });
    const nextOrder = {
        orderNo: (0, utils_1.createOrderNo)(),
        userId: user._id,
        productCode: plan.productCode,
        productName: plan.productName,
        planCode: plan.planCode,
        planName: plan.planName,
        virtualPaymentProductId: plan.virtualPaymentProductId,
        orderType: existingMembership ? 'renew' : 'purchase',
        amount: deduction.payableAmount,
        originalAmount: normalizeAmount(plan.price),
        totalAiPoints: Math.max(0, Math.floor((_c = plan.totalAiPoints) !== null && _c !== void 0 ? _c : 0)),
        pointsDeductionEnabled: usePointsDeduction,
        pointsDeducted: deduction.pointsDeducted,
        pointsDeductAmount: deduction.pointsDeductAmount,
        durationDays: plan.durationDays,
        payStatus: 'pending',
        fulfillmentStatus: 'pending',
        payChannel: (0, payment_config_1.paymentTypeToPayChannel)(appConfig.paymentType),
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
