import { collection, getMembershipByUserId, getOrderByNo, getPlanByCode, getProductTypeByCode, getUserByOpenId } from '../shared/db';
import type { OrderRecord } from '../shared/types';
import { createOrderNo, ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';
import { getClientAppConfig } from '../shared/client-config';
import { paymentTypeToPayChannel } from '../shared/payment-config';
import { calculatePointsDeduction, getPointsConfig } from '../shared/points-config';
import { getEffectiveAiToolConfig } from '../shared/ai-tool-entitlements';
import { migrateLegacyPointsBalanceToAiToolPoints } from '../shared/points-rewards';

interface Event {
  orderNo: string;
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

export async function main(event: Event) {
  const orderNo = event.orderNo?.trim();
  if (!orderNo) {
    throw new Error('缺少订单号');
  }

  const { OPENID } = getWxContext();
  const rawUser = await getUserByOpenId(OPENID);
  if (!rawUser) {
    throw new Error('用户未登录');
  }
  const user = await migrateLegacyPointsBalanceToAiToolPoints(rawUser);

  const oldOrder = await getOrderByNo(orderNo);
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
    const tool = toolId ? await getEffectiveAiToolConfig(toolId) : null;
    if (!tool) {
      throw new Error('工具不存在');
    }
    if (!tool.enabled) {
      throw new Error('该工具正在接入中');
    }
    const [appConfig, pointsConfig] = await Promise.all([
      getClientAppConfig(),
      getPointsConfig(),
    ]);
    const now = Date.now();
    await collection('orders').doc(oldOrder._id).update({
      data: {
        payStatus: 'closed',
        closedAt: now,
        closeReason: 'retry_order_created',
        updatedAt: now,
      },
    });

    const originalAmount = normalizeAmount(tool.pointCost / 10);
    const usePointsDeduction = Boolean(oldOrder.pointsDeductionEnabled);
    const availablePoints = Math.max(0, Math.floor(user.pointsBalance ?? 0));
    const deduction = calculatePointsDeduction({
      price: originalAmount,
      availablePoints,
      usePointsDeduction,
      pointsPerYuan: pointsConfig.pointsPerYuan,
    });
    const nextOrder: OrderRecord = {
      orderNo: createOrderNo('TOOL'),
      userId: user._id,
      productCode: oldOrder.productCode || 'ai_tool_single',
      productName: oldOrder.productName || 'AI工具单次购买',
      planCode: `tool_single_${tool.toolId}`,
      planName: `${tool.name}单次使用`,
      virtualPaymentProductId: getToolSingleVirtualPaymentProductId(tool.toolId),
      orderType: 'tool_single',
      amount: deduction.payableAmount,
      originalAmount,
      pointsDeductionEnabled: usePointsDeduction,
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
    await collection('orders').add({ data: nextOrder });
    return ok({
      orderNo: nextOrder.orderNo,
      oldOrderNo: oldOrder.orderNo,
      amount: nextOrder.amount,
      originalAmount: nextOrder.originalAmount,
    });
  }

  const plan = await getPlanByCode(oldOrder.planCode);
  if (!plan) {
    throw new Error('套餐不存在或已下架，请重新选择套餐');
  }

  const [existingMembership, appConfig, pointsConfig, productType] = await Promise.all([
    getMembershipByUserId(user._id, plan.productCode),
    getClientAppConfig(),
    getPointsConfig(),
    getProductTypeByCode(plan.productCode),
  ]);

  const now = Date.now();
  await collection('orders').doc(oldOrder._id).update({
    data: {
      payStatus: 'closed',
      closedAt: now,
      closeReason: 'retry_order_created',
      updatedAt: now,
    },
  });

  const availablePoints = Math.max(0, Math.floor(user.pointsBalance ?? 0));
  const usePointsDeduction = Boolean(oldOrder.pointsDeductionEnabled);
  const deduction = calculatePointsDeduction({
    price: plan.price,
    availablePoints,
    usePointsDeduction,
    pointsPerYuan: pointsConfig.pointsPerYuan,
  });

  const nextOrder: OrderRecord = {
    orderNo: createOrderNo(),
    userId: user._id,
    productCode: plan.productCode,
    productName: plan.productName,
    planCode: plan.planCode,
    planName: plan.planName,
    virtualPaymentProductId: plan.virtualPaymentProductId,
    orderType: existingMembership ? 'renew' : 'purchase',
    amount: deduction.payableAmount,
    originalAmount: normalizeAmount(plan.price),
    totalAiPoints: Math.max(0, Math.floor(plan.totalAiPoints ?? 0)),
    pointsDeductionEnabled: usePointsDeduction,
    pointsDeducted: deduction.pointsDeducted,
    pointsDeductAmount: deduction.pointsDeductAmount,
    durationDays: plan.durationDays,
    payStatus: 'pending',
    fulfillmentStatus: 'pending',
    fulfillmentMode: oldOrder.fulfillmentMode ?? (productType?.fulfillmentMode === 'manual' ? 'manual' : 'immediate'),
    payChannel: paymentTypeToPayChannel(appConfig.paymentType),
    createdAt: now,
    updatedAt: now,
  };

  await collection('orders').add({ data: nextOrder });

  return ok({
    orderNo: nextOrder.orderNo,
    oldOrderNo: oldOrder.orderNo,
    amount: nextOrder.amount,
    originalAmount: nextOrder.originalAmount,
    pointsDeducted: nextOrder.pointsDeducted,
    pointsDeductAmount: nextOrder.pointsDeductAmount,
  });
}
