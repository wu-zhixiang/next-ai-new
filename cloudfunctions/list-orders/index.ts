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
      return {
        orderNo: order.orderNo,
        productCode: order.productCode,
        productName: order.productName,
        planCode: order.planCode,
        planName: order.planName,
        amount: order.amount,
        durationDays: order.durationDays,
        payStatus: order.payStatus,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        pendingExpireAt: order.payStatus === 'pending' ? getPendingOrderExpireAt(order.createdAt, order.payExpireAt, lastPayAttemptAt) : undefined,
        canPay: order.payStatus === 'pending' && !isPendingOrderExpired(order.createdAt, Date.now(), order.payExpireAt, lastPayAttemptAt),
      };
    }),
  });
}
