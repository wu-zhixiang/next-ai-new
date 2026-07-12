"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const ai_tool_entitlements_1 = require("./shared/ai-tool-entitlements");
const client_config_1 = require("./shared/client-config");
const payment_config_1 = require("./shared/payment-config");
const points_config_1 = require("./shared/points-config");
const points_rewards_1 = require("./shared/points-rewards");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
function normalizeAmount(amount) {
    return Number(amount.toFixed(2));
}
function getToolSingleVirtualPaymentProductId(toolId) {
    const toolKey = toolId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
    return process.env[`WX_VIRTUAL_PAY_PRODUCT_ID_TOOL_SINGLE_${toolKey}`]
        || process.env.WX_VIRTUAL_PAY_PRODUCT_ID_TOOL_SINGLE
        || process.env.WX_VIRTUAL_PAY_PRODUCT_ID_AI_TOOL_SINGLE;
}
async function main(event = {}) {
    var _a;
    const { OPENID } = (0, context_1.getWxContext)();
    const rawUser = await (0, db_1.getUserByOpenId)(OPENID);
    if (!rawUser) {
        throw new Error('用户未登录');
    }
    const user = await (0, points_rewards_1.migrateLegacyPointsBalanceToAiToolPoints)(rawUser);
    const toolId = String(event.toolId || '').trim();
    if (!toolId) {
        throw new Error('缺少工具 ID');
    }
    const tool = await (0, ai_tool_entitlements_1.getEffectiveAiToolConfig)(toolId);
    if (!tool) {
        throw new Error('工具不存在');
    }
    if (!tool.enabled) {
        throw new Error('该工具正在接入中');
    }
    if (tool.pointCost <= 0) {
        throw new Error('该工具暂不支持单次购买');
    }
    const now = Date.now();
    const pendingOrders = await (0, db_1.listPendingOrdersByUserId)(user._id);
    await Promise.all(pendingOrders
        .filter((pendingOrder) => pendingOrder.orderType === 'tool_single' && pendingOrder.toolId === tool.toolId)
        .map((pendingOrder) => (0, db_1.collection)('orders').doc(pendingOrder._id).update({
        data: {
            payStatus: 'closed',
            closedAt: now,
            closeReason: 'new_tool_single_order_created',
            updatedAt: now,
        },
    })));
    const [appConfig, pointsConfig] = await Promise.all([
        (0, client_config_1.getClientAppConfig)(),
        (0, points_config_1.getPointsConfig)(),
    ]);
    const orderNo = (0, utils_1.createOrderNo)('TOOL');
    const originalAmount = normalizeAmount(tool.pointCost / 10);
    const availablePoints = Math.max(0, Math.floor((_a = user.pointsBalance) !== null && _a !== void 0 ? _a : 0));
    const deduction = (0, points_config_1.calculatePointsDeduction)({
        price: originalAmount,
        availablePoints,
        usePointsDeduction: Boolean(event.usePointsDeduction),
        pointsPerYuan: pointsConfig.pointsPerYuan,
    });
    const order = {
        orderNo,
        userId: user._id,
        productCode: 'ai_tool_single',
        productName: 'AI工具单次购买',
        planCode: `tool_single_${tool.toolId}`,
        planName: `${tool.name}单次使用`,
        virtualPaymentProductId: getToolSingleVirtualPaymentProductId(tool.toolId),
        orderType: 'tool_single',
        amount: deduction.payableAmount,
        originalAmount,
        pointsDeductionEnabled: Boolean(event.usePointsDeduction),
        pointsDeducted: deduction.pointsDeducted,
        pointsDeductAmount: deduction.pointsDeductAmount,
        toolId: tool.toolId,
        toolName: tool.name,
        toolPointCost: tool.pointCost,
        durationDays: 0,
        payStatus: 'pending',
        fulfillmentStatus: 'pending',
        fulfillmentMode: 'immediate',
        payChannel: (0, payment_config_1.paymentTypeToPayChannel)(appConfig.paymentType),
        createdAt: now,
        updatedAt: now,
    };
    await (0, db_1.collection)('orders').add({ data: order });
    return (0, utils_1.ok)({
        orderNo,
        amount: deduction.payableAmount,
        originalAmount,
        pointsDeducted: deduction.pointsDeducted,
        pointsDeductAmount: deduction.pointsDeductAmount,
        toolId: tool.toolId,
        toolName: tool.name,
        pointCost: tool.pointCost,
    });
}
