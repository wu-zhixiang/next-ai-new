import { collection, getOrderByNo, getUserById } from '../shared/db';
import { createWechatPayV2Order } from '../shared/wechat';
import { ok } from '../shared/utils';

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

  const user = await getUserById(order.userId);
  if (!user?.openid) {
    throw new Error('订单用户缺少 openid，无法发起微信支付');
  }

  const payment = await createWechatPayV2Order(order, user.openid);

  await collection('orders').doc(order._id).update({
    data: {
      prepayId: payment.prepayId,
      updatedAt: Date.now(),
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
