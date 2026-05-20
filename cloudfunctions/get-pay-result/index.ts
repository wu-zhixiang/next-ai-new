import { collection, getMembershipByUserId, getOrderByNo } from '../shared/db';
import { getPendingOrderExpireAt, isPendingOrderExpired, normalizeMembership, ok } from '../shared/utils';

interface Event {
  orderNo: string;
}

export async function main(event: Event) {
  const order = await getOrderByNo(event.orderNo);
  if (!order) {
    throw new Error('订单不存在');
  }

  const now = Date.now();
  const lastPayAttemptAt = order.prepayId ? order.updatedAt : undefined;
  const pendingExpireAt = getPendingOrderExpireAt(order.createdAt, order.payExpireAt, lastPayAttemptAt);
  const pendingExpired = order.payStatus === 'pending' && isPendingOrderExpired(order.createdAt, now, order.payExpireAt, lastPayAttemptAt);
  const payStatus = pendingExpired ? 'closed' : order.payStatus;
  if (pendingExpired) {
    await collection('orders').doc(order._id).update({
      data: {
        payStatus,
        closedAt: now,
        closeReason: 'pending_order_expired',
        updatedAt: now,
      },
    });
  }

  const membership = await getMembershipByUserId(order.userId, order.productCode);
  return ok({
    orderNo: order.orderNo,
    productName: order.productName,
    planName: order.planName,
    amount: order.amount,
    originalAmount: order.originalAmount,
    pointsDeducted: order.pointsDeducted,
    pointsDeductAmount: order.pointsDeductAmount,
    createdAt: order.createdAt,
    payStatus,
    fulfillmentStatus: order.fulfillmentStatus ?? (payStatus === 'paid' ? 'fulfilled' : 'pending'),
    paidAt: order.paidAt,
    fulfilledAt: order.fulfilledAt,
    pendingExpireAt: order.payStatus === 'pending' || pendingExpired ? pendingExpireAt : undefined,
    canPay: payStatus === 'pending',
    membership:
      membership && (membership.status === 'active' || membership.status === 'opening')
        ? {
            status: membership.status,
            startAt: membership.startAt,
            endAt: membership.endAt,
            remainDays: normalizeMembership(membership).remainDays ?? 0,
          }
        : undefined,
  });
}
