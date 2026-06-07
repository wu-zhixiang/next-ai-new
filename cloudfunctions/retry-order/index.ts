import { collection, getMembershipByUserId, getOrderByNo, getPlanByCode, getUserByOpenId } from '../shared/db';
import type { OrderRecord } from '../shared/types';
import { createOrderNo, ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

interface Event {
  orderNo: string;
}

function normalizeAmount(amount: number): number {
  return Number(amount.toFixed(2));
}

export async function main(event: Event) {
  const orderNo = event.orderNo?.trim();
  if (!orderNo) {
    throw new Error('缺少订单号');
  }

  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    throw new Error('用户未登录');
  }

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

  const plan = await getPlanByCode(oldOrder.planCode);
  if (!plan) {
    throw new Error('套餐不存在或已下架，请重新选择套餐');
  }

  const now = Date.now();
  await collection('orders').doc(oldOrder._id).update({
    data: {
      payStatus: 'closed',
      closedAt: now,
      closeReason: 'retry_order_created',
      updatedAt: now,
    },
  });

  const existingMembership = await getMembershipByUserId(user._id, plan.productCode);
  const availablePoints = Math.max(0, Math.floor(user.pointsBalance ?? 0));
  const maxDeductiblePoints = Math.floor(plan.price);
  const usePointsDeduction = Boolean(oldOrder.pointsDeductionEnabled);
  const pointsDeducted = usePointsDeduction ? Math.min(availablePoints, maxDeductiblePoints) : 0;
  const payableAmount = normalizeAmount(Math.max(0, plan.price - pointsDeducted));

  const nextOrder: OrderRecord = {
    orderNo: createOrderNo(),
    userId: user._id,
    productCode: plan.productCode,
    productName: plan.productName,
    planCode: plan.planCode,
    planName: plan.planName,
    virtualPaymentProductId: plan.virtualPaymentProductId,
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
