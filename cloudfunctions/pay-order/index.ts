import { collection, getOrderByNo, getUserById } from '../shared/db';
import { markOrderPaidAndOpenMembership } from '../shared/orders';
import { createWechatPayV2Order, WechatPayV2OrderError } from '../shared/wechat';
import { getPendingOrderExpireAt, isPendingOrderExpired, ok } from '../shared/utils';

interface Event {
  orderNo: string;
}

export async function main(event: Event) {
  const order = await getOrderByNo(event.orderNo);
  if (!order) {
    throw new Error('订单不存在');
  }

  if (order.payStatus !== 'pending') {
    throw new Error('订单状态不可支付');
  }
  const lastPayAttemptAt = order.prepayId ? order.updatedAt : undefined;
  if (isPendingOrderExpired(order.createdAt, Date.now(), order.payExpireAt, lastPayAttemptAt)) {
    const now = Date.now();
    await collection('orders').doc(order._id).update({
      data: {
        payStatus: 'closed',
        closedAt: now,
        closeReason: 'pending_order_expired',
        updatedAt: now,
      },
    });
    throw new Error('订单已超过 30 分钟有效期，请重新下单');
  }

  const user = await getUserById(order.userId);
  if (!user?.openid) {
    throw new Error('订单用户缺少 openid，无法发起微信支付');
  }

  let payment: Awaited<ReturnType<typeof createWechatPayV2Order>>;
  try {
    payment = await createWechatPayV2Order(order, user.openid);
  } catch (error) {
    if (error instanceof WechatPayV2OrderError && error.errCode === 'ORDERPAID') {
      await markOrderPaidAndOpenMembership(order);
      return ok({
        orderNo: order.orderNo,
        paid: true,
        message: '订单已支付，已同步会员状态',
      });
    }
    throw error;
  }
  const now = Date.now();

  await collection('orders').doc(order._id).update({
    data: {
      prepayId: payment.prepayId,
      payExpireAt: getPendingOrderExpireAt(now),
      updatedAt: now,
    },
  });

  return ok({
    orderNo: order.orderNo,
    payment: {
      timeStamp: payment.timeStamp,
      nonceStr: payment.nonceStr,
      package: payment.package,
      signType: payment.signType,
      paySign: payment.paySign,
    },
  });
}
