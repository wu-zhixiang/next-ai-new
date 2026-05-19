import { getOrderByNo } from '../shared/db';
import { markOrderPaidAndOpenMembership } from '../shared/orders';
import { ok, parseWechatPayTime, toWechatPaymentAmount } from '../shared/utils';
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
  echostr?: string;
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
  headers?: Record<string, string>;
  Event?: string;
  OutTradeNo?: string;
  OpenId?: string;
  WeChatPayInfo?: {
    MchOrderNo?: string;
    TransactionId?: string;
    PaidTime?: number;
  };
  GoodsInfo?: {
    ProductId?: string;
    Quantity?: number;
    OrigPrice?: number;
    ActualPrice?: number;
    Attach?: string;
  };
  Env?: number;
}

interface NormalizedNotify {
  raw: Record<string, string>;
  callbackMode: boolean;
  echostr?: string;
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
  Event?: string;
  OutTradeNo?: string;
  OpenId?: string;
  WeChatPayInfo?: Event['WeChatPayInfo'];
  GoodsInfo?: Event['GoodsInfo'];
  Env?: number;
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

function notifyTextResponse(body: string) {
  return {
    statusCode: 200,
    headers: {
      'content-type': 'text/plain',
    },
    body,
  };
}

export async function main(event: Event) {
  const notify = normalizeNotifyEvent(event);
  if (notify.echostr) {
    return notifyTextResponse(notify.echostr);
  }

  if (isVirtualPaymentNotify(notify)) {
    return handleVirtualPaymentNotify(notify);
  }

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
    console.error(
      JSON.stringify({
        tag: 'wechatPay.v2.notify.missingOrderNo',
        callbackMode: notify.callbackMode,
        keys: Object.keys(notify.raw).sort(),
      }),
    );
    return notifyXmlResponse('FAIL', '缺少订单号');
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
    return notifyXmlResponse('FAIL', '订单不存在');
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
    return notifyXmlResponse('FAIL', '订单金额不匹配');
  }

  if (order.payStatus === 'paid') {
    return notify.callbackMode ? notifyXmlResponse('SUCCESS', 'OK') : ok({ success: true, duplicated: true });
  }

  const now = notify.paidAt ?? parseWechatPayTime(notify.time_end);
  await markOrderPaidAndOpenMembership(order, {
    transactionId: notify.transactionId ?? notify.transaction_id ?? '',
    paidAt: now,
  });

  console.log(JSON.stringify({ tag: 'wechatPay.v2.notify.applied', orderNo, userId: order.userId, productCode: order.productCode }));
  return notify.callbackMode ? notifyXmlResponse('SUCCESS', 'OK') : ok({ success: true });
}

async function handleVirtualPaymentNotify(notify: NormalizedNotify) {
  const orderNo = notify.OutTradeNo || notify.orderNo || notify.outTradeNo || notify.out_trade_no;
  console.log(
    JSON.stringify({
      tag: 'wechatVirtualPay.notify.received',
      event: notify.Event,
      orderNo,
      openIdPrefix: notify.OpenId?.slice(0, 6),
      productId: notify.GoodsInfo?.ProductId,
      actualPrice: notify.GoodsInfo?.ActualPrice,
      transactionId: notify.WeChatPayInfo?.TransactionId,
      keys: Object.keys(notify.raw).sort(),
    }),
  );

  if (!orderNo) {
    console.error(JSON.stringify({ tag: 'wechatVirtualPay.notify.missingOrderNo', event: notify.Event }));
    return notifyTextResponse('fail');
  }

  const order = await getOrderByNo(orderNo);
  if (!order) {
    console.error(JSON.stringify({ tag: 'wechatVirtualPay.notify.orderMissing', orderNo }));
    return notifyTextResponse('fail');
  }

  if (
    typeof notify.GoodsInfo?.ActualPrice === 'number' &&
    notify.GoodsInfo.ActualPrice !== toWechatPaymentAmount(order.amount)
  ) {
    console.error(
      JSON.stringify({
        tag: 'wechatVirtualPay.notify.amountMismatch',
        orderNo,
        notifyActualPrice: notify.GoodsInfo.ActualPrice,
        orderTotalFee: toWechatPaymentAmount(order.amount),
      }),
    );
    return notifyTextResponse('fail');
  }

  if (order.payStatus === 'paid') {
    return notifyTextResponse('success');
  }

  await markOrderPaidAndOpenMembership(order, {
    transactionId: notify.WeChatPayInfo?.TransactionId ?? notify.transactionId ?? '',
    paidAt: notify.WeChatPayInfo?.PaidTime ? notify.WeChatPayInfo.PaidTime * 1000 : Date.now(),
  });

  console.log(JSON.stringify({ tag: 'wechatVirtualPay.notify.applied', orderNo, userId: order.userId, productCode: order.productCode }));
  return notifyTextResponse('success');
}

function isVirtualPaymentNotify(notify: NormalizedNotify): boolean {
  return notify.Event === 'xpay_goods_deliver_notify' || notify.Event === 'xpay_coin_pay_notify';
}

function normalizeNotifyEvent(event: Event): NormalizedNotify {
  const httpBody = getHttpBody(event);
  const xml = httpBody.includes('<xml>') ? httpBody : '';
  if (xml) {
    const parsed = parseWechatPayXml(xml) as WechatPayV2Notify & Record<string, string>;
    return {
      raw: parsed,
      callbackMode: !parsed.Event,
      orderNo: parsed.out_trade_no,
      out_trade_no: parsed.out_trade_no,
      transaction_id: parsed.transaction_id,
      time_end: parsed.time_end,
      return_code: parsed.return_code,
      result_code: parsed.result_code,
      total_fee: parsed.total_fee,
      Event: parsed.Event,
      OutTradeNo: parsed.OutTradeNo,
      OpenId: parsed.OpenId,
      WeChatPayInfo: parsed.TransactionId || parsed.PaidTime
        ? {
            TransactionId: parsed.TransactionId,
            PaidTime: parsed.PaidTime ? Number(parsed.PaidTime) : undefined,
          }
        : undefined,
      GoodsInfo: parsed.ActualPrice || parsed.ProductId
        ? {
            ProductId: parsed.ProductId,
            ActualPrice: parsed.ActualPrice ? Number(parsed.ActualPrice) : undefined,
          }
        : undefined,
    };
  }

  const jsonBody = parseJsonBody(httpBody);
  const eventLike = {
    ...event,
    ...jsonBody,
  };

  return {
    raw: Object.fromEntries(
      Object.entries(eventLike)
        .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
        .map(([key, value]) => [key, String(value)]),
    ),
    callbackMode: Boolean(eventLike.outTradeNo || eventLike.out_trade_no || eventLike.return_code || eventLike.result_code),
    ...eventLike,
  };
}

function getHttpBody(event: Event): string {
  const body = event.body ?? event.rawBody ?? '';
  if (!body) {
    return '';
  }

  return event.isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
}

function parseJsonBody(body: string): Partial<Event> {
  if (!body) {
    return {};
  }
  try {
    const parsed = JSON.parse(body) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Partial<Event>) : {};
  } catch {
    return {};
  }
}
