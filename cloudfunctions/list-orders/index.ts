import { getUserByOpenId, listOrdersByUserId } from '../shared/db';
import { getPendingOrderExpireAt, isPendingOrderExpired, ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

export async function main() {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    return ok({ orders: [] });
  }

  const orders = await listOrdersByUserId(user._id);
  return ok({
    orders: orders.map((order) => {
      const lastPayAttemptAt = order.prepayId ? order.updatedAt : undefined;
      const isOpening = order.fulfillmentStatus === 'opening';
      const isPending = order.payStatus === 'pending' && !isOpening;
      return {
        orderNo: order.orderNo,
        productCode: order.productCode,
        productName: order.productName,
        planCode: order.planCode,
        planName: order.planName,
        amount: order.amount,
        originalAmount: order.originalAmount,
        pointsDeducted: order.pointsDeducted,
        pointsDeductAmount: order.pointsDeductAmount,
        durationDays: order.durationDays,
        payStatus: order.payStatus,
        fulfillmentStatus: order.fulfillmentStatus ?? (order.payStatus === 'paid' ? 'fulfilled' : 'pending'),
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        fulfilledAt: order.fulfilledAt,
        pendingExpireAt: isPending ? getPendingOrderExpireAt(order.createdAt, order.payExpireAt, lastPayAttemptAt) : undefined,
        canPay: isPending && !isPendingOrderExpired(order.createdAt, Date.now(), order.payExpireAt, lastPayAttemptAt),
      };
    }),
  });
}
