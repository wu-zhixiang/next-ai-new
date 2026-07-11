import { collection, getMembershipByUserId, getPlanByPid, getUserByOpenId, listMembershipsByUserId, listOrdersByUserId, listPendingOrdersByUserId } from '../shared/db';
import type { OrderRecord } from '../shared/types';
import { createOrderNo, ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';
import { DEFAULT_PRODUCT_CODE } from '../shared/constants';
import { getClientAppConfig } from '../shared/client-config';
import { paymentTypeToPayChannel } from '../shared/payment-config';
import { calculatePointsDeduction, getPointsConfig } from '../shared/points-config';
import { migrateLegacyPointsBalanceToAiToolPoints } from '../shared/points-rewards';

interface Event {
  pid: string;
  usePointsDeduction?: boolean;
}

function normalizeAmount(amount: number): number {
  return Number(amount.toFixed(2));
}

function normalizePurchasedProductCode(record: { productCode?: string }): string {
  return record.productCode || DEFAULT_PRODUCT_CODE;
}

async function hasPurchasedProductBefore(userId: string, productCode: string): Promise<boolean> {
  const [memberships, orders] = await Promise.all([
    listMembershipsByUserId(userId),
    listOrdersByUserId(userId),
  ]);
  return memberships.some((membership) => normalizePurchasedProductCode(membership) === productCode)
    || orders.some((order) => normalizePurchasedProductCode(order) === productCode && order.payStatus === 'paid');
}

export async function main(event: Event) {
  const { OPENID } = getWxContext();
  const rawUser = await getUserByOpenId(OPENID);
  if (!rawUser) {
    throw new Error('用户未登录');
  }
  const user = await migrateLegacyPointsBalanceToAiToolPoints(rawUser);
  if (!user.mobile) {
    throw new Error('请先完成手机号授权');
  }

  if (!event.pid) {
    throw new Error('套餐缺少 pid，请刷新后重试');
  }

  const plan = await getPlanByPid(event.pid);
  if (!plan) {
    throw new Error('套餐不存在或已下架');
  }

  const [existingMembership, purchasedBefore, appConfig, pointsConfig] = await Promise.all([
    getMembershipByUserId(user._id, plan.productCode),
    hasPurchasedProductBefore(user._id, plan.productCode),
    getClientAppConfig(),
    getPointsConfig(),
  ]);

  const now = Date.now();
  const pendingOrders = await listPendingOrdersByUserId(user._id);
  await Promise.all(
    pendingOrders.map((pendingOrder) =>
      collection('orders').doc(pendingOrder._id).update({
        data: {
          payStatus: 'closed',
          closedAt: now,
          closeReason: 'new_order_created',
          updatedAt: now,
        },
      }),
    ),
  );

  const orderNo = createOrderNo();
  const aiToolPointPlan = Math.max(0, Math.floor(plan.totalAiPoints ?? 0)) > 0;
  const availablePoints = Math.max(0, Math.floor(user.aiToolPointsBalance ?? 0));
  const deduction = calculatePointsDeduction({
    price: plan.price,
    availablePoints,
    usePointsDeduction: aiToolPointPlan && Boolean(event.usePointsDeduction),
    pointsPerYuan: pointsConfig.pointsPerYuan,
  });
  const order: OrderRecord = {
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
    totalAiPoints: Math.max(0, Math.floor(plan.totalAiPoints ?? 0)),
    pointsDeductionEnabled: aiToolPointPlan && Boolean(event.usePointsDeduction),
    pointsDeducted: deduction.pointsDeducted,
    pointsDeductAmount: deduction.pointsDeductAmount,
    durationDays: plan.durationDays,
    payStatus: 'pending',
    fulfillmentStatus: 'pending',
    payChannel: paymentTypeToPayChannel(appConfig.paymentType),
    createdAt: now,
    updatedAt: now,
  };

  await collection('orders').add({ data: order });

  return ok({
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
