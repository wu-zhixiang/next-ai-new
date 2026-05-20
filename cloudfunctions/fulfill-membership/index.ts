import { getOrderByNo } from '../shared/db';
import { fulfillPaidOrderMembership } from '../shared/orders';
import { ok } from '../shared/utils';

interface Event {
  orderNo: string;
  fulfilledAt?: number;
}

export async function main(event: Event) {
  const orderNo = event.orderNo?.trim();
  if (!orderNo) {
    throw new Error('缺少订单号');
  }

  const order = await getOrderByNo(orderNo);
  if (!order) {
    throw new Error('订单不存在');
  }

  await fulfillPaidOrderMembership(order, {
    fulfilledAt: event.fulfilledAt,
  });

  return ok({
    success: true,
    orderNo: order.orderNo,
  });
}
