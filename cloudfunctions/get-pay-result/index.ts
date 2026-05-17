import { getMembershipByUserId, getOrderByNo } from '../shared/db';
import { normalizeMembership, ok } from '../shared/utils';

interface Event {
  orderNo: string;
}

export async function main(event: Event) {
  const order = await getOrderByNo(event.orderNo);
  if (!order) {
    throw new Error('订单不存在');
  }

  const membership = await getMembershipByUserId(order.userId, order.productCode);
  return ok({
    orderNo: order.orderNo,
    payStatus: order.payStatus,
    paidAt: order.paidAt,
    membership:
      membership && membership.status === 'active'
        ? {
            status: 'active' as const,
            startAt: membership.startAt,
            endAt: membership.endAt,
            remainDays: normalizeMembership(membership).remainDays ?? 0,
          }
        : undefined,
  });
}
