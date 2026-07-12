import { collection, getUserByOpenId, listPendingOrdersByUserId } from '../shared/db';
import { getEffectiveAiToolConfig } from '../shared/ai-tool-entitlements';
import { getClientAppConfig } from '../shared/client-config';
import { paymentTypeToPayChannel } from '../shared/payment-config';
import { calculatePointsDeduction, getPointsConfig } from '../shared/points-config';
import { migrateLegacyPointsBalanceToAiToolPoints } from '../shared/points-rewards';
import type { OrderRecord } from '../shared/types';
import { createOrderNo, ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

interface Event {
  toolId?: string;
  usePointsDeduction?: boolean;
}

function normalizeAmount(amount: number): number {
  return Number(amount.toFixed(2));
}

function getToolSingleVirtualPaymentProductId(toolId: string): string | undefined {
  const toolKey = toolId.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase();
  return process.env[`WX_VIRTUAL_PAY_PRODUCT_ID_TOOL_SINGLE_${toolKey}`]
    || process.env.WX_VIRTUAL_PAY_PRODUCT_ID_TOOL_SINGLE
    || process.env.WX_VIRTUAL_PAY_PRODUCT_ID_AI_TOOL_SINGLE;
}

export async function main(event: Event = {}) {
  const { OPENID } = getWxContext();
  const rawUser = await getUserByOpenId(OPENID);
  if (!rawUser) {
    throw new Error('用户未登录');
  }
  const user = await migrateLegacyPointsBalanceToAiToolPoints(rawUser);

  const toolId = String(event.toolId || '').trim();
  if (!toolId) {
    throw new Error('缺少工具 ID');
  }

  const tool = await getEffectiveAiToolConfig(toolId);
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
  const pendingOrders = await listPendingOrdersByUserId(user._id);
  await Promise.all(
    pendingOrders
      .filter((pendingOrder) => pendingOrder.orderType === 'tool_single' && pendingOrder.toolId === tool.toolId)
      .map((pendingOrder) =>
        collection('orders').doc(pendingOrder._id).update({
          data: {
            payStatus: 'closed',
            closedAt: now,
            closeReason: 'new_tool_single_order_created',
            updatedAt: now,
          },
        }),
      ),
  );

  const [appConfig, pointsConfig] = await Promise.all([
    getClientAppConfig(),
    getPointsConfig(),
  ]);
  const orderNo = createOrderNo('TOOL');
  const originalAmount = normalizeAmount(tool.pointCost / 10);
  const availablePoints = Math.max(0, Math.floor(user.pointsBalance ?? 0));
  const deduction = calculatePointsDeduction({
    price: originalAmount,
    availablePoints,
    usePointsDeduction: Boolean(event.usePointsDeduction),
    pointsPerYuan: pointsConfig.pointsPerYuan,
  });
  const order: OrderRecord = {
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
    payChannel: paymentTypeToPayChannel(appConfig.paymentType),
    createdAt: now,
    updatedAt: now,
  };

  await collection('orders').add({ data: order });

  return ok({
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
