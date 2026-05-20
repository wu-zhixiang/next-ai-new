import { collection, getMembershipByUserId, getPlanByCode, getUserByOpenId, listPendingOrdersByUserId } from '../shared/db';
import type { OrderRecord } from '../shared/types';
import { createOrderNo, ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

interface Event {
  planCode: string;
  usePointsDeduction?: boolean;
}

function normalizeAmount(amount: number): number {
  return Number(amount.toFixed(2));
}

export async function main(event: Event) {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    throw new Error('用户未登录');
  }
  if (!user.mobile) {
    throw new Error('请先完成手机号授权');
  }

  const plan = await getPlanByCode(event.planCode);
  if (!plan) {
    throw new Error('套餐不存在或已下架');
  }

  const existingMembership = await getMembershipByUserId(user._id, plan.productCode);

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
  const availablePoints = Math.max(0, Math.floor(user.pointsBalance ?? 0));
  const maxDeductiblePoints = Math.floor(plan.price);
  const pointsDeducted = event.usePointsDeduction ? Math.min(availablePoints, maxDeductiblePoints) : 0;
  const payableAmount = normalizeAmount(Math.max(0, plan.price - pointsDeducted));
  const order: OrderRecord = {
    orderNo,
    userId: user._id,
    productCode: plan.productCode,
    productName: plan.productName,
    planCode: plan.planCode,
    planName: plan.planName,
    orderType: existingMembership ? 'renew' : 'purchase',
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

  await collection('orders').add({ data: order });

  return ok({
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
