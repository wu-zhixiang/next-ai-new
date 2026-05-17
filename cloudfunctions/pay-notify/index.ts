import { collection, getMembershipByUserId, getOrderByNo } from '../shared/db';
import type { MembershipRecord } from '../shared/types';
import { calcRemainDays, ok, parseWechatPayTime, toWechatPaymentAmount } from '../shared/utils';
import {
  buildWechatPayNotifyResponse,
  parseWechatPayXml,
  verifyWechatPayV2Sign,
  type WechatPayV2Notify,
} from '../shared/wechat';

interface Event {
  body?: string;
  rawBody?: string;
  isBase64Encoded?: boolean;
  orderNo?: string;
  transactionId?: string;
  paidAt?: number;
  outTradeNo?: string;
  out_trade_no?: string;
  transaction_id?: string;
  time_end?: string;
  return_code?: string;
  result_code?: string;
  total_fee?: string;
  sign?: string;
}

interface NormalizedNotify {
  raw: Record<string, string>;
  callbackMode: boolean;
  orderNo?: string;
  outTradeNo?: string;
  out_trade_no?: string;
  transactionId?: string;
  transaction_id?: string;
  paidAt?: number;
  time_end?: string;
  return_code?: string;
  result_code?: string;
  total_fee?: string;
}

function notifyXmlResponse(returnCode: 'SUCCESS' | 'FAIL', returnMsg: string) {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/xml',
    },
    body: buildWechatPayNotifyResponse(returnCode, returnMsg),
  };
}

export async function main(event: Event) {
  const notify = normalizeNotifyEvent(event);
  const orderNo = notify.orderNo || notify.outTradeNo || notify.out_trade_no;
  console.log(
    JSON.stringify({
      tag: 'wechatPay.v2.notify.received',
      callbackMode: notify.callbackMode,
      orderNo,
      returnCode: notify.return_code,
      resultCode: notify.result_code,
      transactionId: notify.transaction_id || notify.transactionId,
      totalFee: notify.total_fee,
      keys: Object.keys(notify.raw).sort(),
    }),
  );
  if (!orderNo) {
    return notify.callbackMode ? notifyXmlResponse('FAIL', '缺少订单号') : Promise.reject(new Error('缺少订单号'));
  }

  if (notify.callbackMode) {
    let signValid = false;
    try {
      signValid = verifyWechatPayV2Sign(notify.raw);
    } catch (error) {
      console.error(
        JSON.stringify({
          tag: 'wechatPay.v2.notify.signVerifyError',
          orderNo,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return notifyXmlResponse('FAIL', '验签配置错误');
    }

    if (!signValid) {
      console.error(JSON.stringify({ tag: 'wechatPay.v2.notify.signFailed', orderNo }));
      return notifyXmlResponse('FAIL', '签名错误');
    }
  }

  if ((notify.return_code && notify.return_code !== 'SUCCESS') || (notify.result_code && notify.result_code !== 'SUCCESS')) {
    return notify.callbackMode ? notifyXmlResponse('SUCCESS', 'OK') : ok({ success: false, ignored: true });
  }

  const order = await getOrderByNo(orderNo);
  if (!order) {
    console.error(JSON.stringify({ tag: 'wechatPay.v2.notify.orderMissing', orderNo }));
    return notify.callbackMode ? notifyXmlResponse('FAIL', '订单不存在') : Promise.reject(new Error('订单不存在'));
  }

  if (notify.total_fee && Number(notify.total_fee) !== toWechatPaymentAmount(order.amount)) {
    console.error(
      JSON.stringify({
        tag: 'wechatPay.v2.notify.amountMismatch',
        orderNo,
        notifyTotalFee: notify.total_fee,
        orderTotalFee: toWechatPaymentAmount(order.amount),
      }),
    );
    return notify.callbackMode ? notifyXmlResponse('FAIL', '订单金额不匹配') : Promise.reject(new Error('订单金额不匹配'));
  }

  if (order.payStatus === 'paid') {
    return notify.callbackMode ? notifyXmlResponse('SUCCESS', 'OK') : ok({ success: true, duplicated: true });
  }

  const now = notify.paidAt ?? parseWechatPayTime(notify.time_end);
  await collection('orders').doc(order._id).update({
    data: {
      payStatus: 'paid',
      transactionId: notify.transactionId ?? notify.transaction_id ?? '',
      paidAt: now,
      updatedAt: now,
    },
  });

  const existingMembership = await getMembershipByUserId(order.userId, order.productCode);
  const startAt = existingMembership && existingMembership.endAt > now ? existingMembership.endAt : now;
  const endAt = startAt + order.durationDays * 24 * 60 * 60 * 1000;

  if (existingMembership) {
    await collection('memberships').doc(existingMembership._id).update({
      data: {
        productCode: order.productCode,
        productName: order.productName,
        planCode: order.planCode,
        planName: order.planName,
        status: 'active',
        startAt: existingMembership.startAt,
        endAt,
        remainDays: calcRemainDays(endAt, now),
        updatedAt: now,
      },
    });
  } else {
    const membership: MembershipRecord = {
      userId: order.userId,
      productCode: order.productCode,
      productName: order.productName,
      planCode: order.planCode,
      planName: order.planName,
      status: 'active',
      startAt: now,
      endAt,
      remainDays: calcRemainDays(endAt, now),
      autoRenewStatus: 'off',
      createdAt: now,
      updatedAt: now,
    };
    await collection('memberships').add({ data: membership });
  }

  console.log(JSON.stringify({ tag: 'wechatPay.v2.notify.applied', orderNo, userId: order.userId, productCode: order.productCode }));
  return notify.callbackMode ? notifyXmlResponse('SUCCESS', 'OK') : ok({ success: true });
}

function normalizeNotifyEvent(event: Event): NormalizedNotify {
  const xml = getHttpBody(event);
  if (xml) {
    const parsed = parseWechatPayXml(xml) as WechatPayV2Notify & Record<string, string>;
    return {
      raw: parsed,
      callbackMode: true,
      orderNo: parsed.out_trade_no,
      out_trade_no: parsed.out_trade_no,
      transaction_id: parsed.transaction_id,
      time_end: parsed.time_end,
      return_code: parsed.return_code,
      result_code: parsed.result_code,
      total_fee: parsed.total_fee,
    };
  }

  return {
    raw: Object.fromEntries(
      Object.entries(event)
        .filter(([, value]) => typeof value === 'string')
        .map(([key, value]) => [key, value as string]),
    ),
    callbackMode: Boolean(event.outTradeNo || event.out_trade_no || event.return_code || event.result_code),
    ...event,
  };
}

function getHttpBody(event: Event): string {
  const body = event.body ?? event.rawBody ?? '';
  if (!body || !body.includes('<xml>')) {
    return '';
  }

  return event.isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
}
