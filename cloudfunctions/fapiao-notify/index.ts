import { collection, getInvoiceRequestByFapiaoApplyId } from '../shared/db';
import {
  decryptWechatPayResource,
  getWechatPayHeader,
  getWechatPayV3Config,
  verifyWechatPayV3Signature,
  type WechatPayEncryptedResource,
} from '../shared/wechat-pay-v3';

interface Event {
  body?: string;
  rawBody?: string;
  isBase64Encoded?: boolean;
  headers?: Record<string, string | undefined>;
  id?: string;
  event_type?: string;
  resource_type?: string;
  resource?: WechatPayEncryptedResource;
}

interface FapiaoIssuedResource {
  mchid?: string;
  fapiao_apply_id?: string;
  fapiao_information?: FapiaoInformation[] | FapiaoInformation;
}

interface FapiaoInformation {
  fapiao_id?: string;
  fapiao_status?: string;
  card_status?: string;
  invoice_code?: string;
  invoice_no?: string;
  card_openid?: string;
}

function normalizeFapiaoInformation(value: FapiaoIssuedResource['fapiao_information']): FapiaoInformation[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    return [value];
  }
  return [];
}

function jsonResponse(statusCode: number, body?: unknown) {
  return {
    statusCode,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
    body: body === undefined ? '' : JSON.stringify(body),
  };
}

function normalizeBody(event: Event): string {
  const raw = event.rawBody ?? event.body ?? '';
  return event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;
}

function parseNotify(event: Event, body: string): Event {
  if (event.resource) {
    return event;
  }
  if (!body) {
    return event;
  }
  const parsed = JSON.parse(body) as unknown;
  return parsed && typeof parsed === 'object' ? parsed as Event : event;
}

async function applyIssuedResource(resource: FapiaoIssuedResource) {
  const fapiaoApplyId = resource.fapiao_apply_id;
  if (!fapiaoApplyId) {
    throw new Error('回调缺少发票申请单号');
  }
  const invoice = await getInvoiceRequestByFapiaoApplyId(fapiaoApplyId);
  if (!invoice) {
    throw new Error('发票申请不存在');
  }
  if (invoice.status === 'issued') {
    return;
  }
  const fapiaoInformation = normalizeFapiaoInformation(resource.fapiao_information);
  const matched = fapiaoInformation.find((item) => item.fapiao_id === invoice.fapiaoId)
    ?? fapiaoInformation[0];
  if (!matched) {
    throw new Error('回调缺少发票信息');
  }
  const now = Date.now();
  const issued = matched.fapiao_status === 'ISSUED';
  const status = issued ? 'issued' : matched.fapiao_status === 'ISSUE_FAILED' ? 'failed' : 'processing';
  await collection('invoiceRequests').doc(invoice._id).update({
    data: {
      status,
      wechatFapiaoStatus: matched.fapiao_status,
      cardOpenid: matched.card_openid,
      invoiceCode: matched.invoice_code,
      invoiceNumber: matched.invoice_no,
      invoiceNoFromWechat: matched.invoice_no,
      issuedAt: issued ? now : invoice.issuedAt,
      failReason: status === 'failed' ? '微信支付通知发票开具失败' : invoice.failReason,
      updatedAt: now,
    },
  });
  await Promise.all(invoice.orderNos.map(async (orderNo) => {
    const result = await collection('orders').where({ orderNo }).get();
    const order = result.data[0] as { _id?: string } | undefined;
    if (!order?._id) {
      return;
    }
    await collection('orders').doc(order._id).update({
      data: {
        invoiceStatus: status,
        invoiceNo: invoice.invoiceNo,
        updatedAt: now,
      },
    });
  }));
}

export async function main(event: Event) {
  const body = normalizeBody(event);
  try {
    const config = getWechatPayV3Config();
    const headers = event.headers ?? {};
    const serial = getWechatPayHeader(headers, 'Wechatpay-Serial');
    const signature = getWechatPayHeader(headers, 'Wechatpay-Signature');
    const timestamp = getWechatPayHeader(headers, 'Wechatpay-Timestamp');
    const nonce = getWechatPayHeader(headers, 'Wechatpay-Nonce');
    if (!verifyWechatPayV3Signature({ timestamp, nonce, body, signature, serial, config })) {
      return jsonResponse(401, { code: 'FAIL', message: '签名验证失败' });
    }

    const notify = parseNotify(event, body);
    if (notify.event_type !== 'FAPIAO.ISSUED' || !notify.resource) {
      return jsonResponse(204);
    }
    const resource = decryptWechatPayResource<FapiaoIssuedResource>(notify.resource);
    await applyIssuedResource(resource);
    return jsonResponse(204);
  } catch (error) {
    console.error(JSON.stringify({
      tag: 'wechatPay.fapiao.notify.failed',
      message: error instanceof Error ? error.message : String(error),
    }));
    return jsonResponse(500, { code: 'FAIL', message: error instanceof Error ? error.message : '处理失败' });
  }
}
