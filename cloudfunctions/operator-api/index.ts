import { decryptAiAccountPassword } from '../shared/ai-account';
import { collection, getLatestUnusedEmailVerificationCode, getOrderByNo, getUserById } from '../shared/db';
import { fulfillPaidOrderMembership } from '../shared/orders';
import type { FulfillmentStatus, OrderRecord } from '../shared/types';

interface Event {
  httpMethod?: string;
  method?: string;
  path?: string;
  rawPath?: string;
  queryStringParameters?: Record<string, string | undefined>;
  headers?: Record<string, string | undefined>;
  body?: string;
  isBase64Encoded?: boolean;
  action?: 'listTasks' | 'updateTask' | 'getVerificationCode';
  status?: string;
  orderNo?: string;
  note?: string;
}

interface HttpResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

type OperatorTaskStatus = 'opening' | 'processing' | 'fulfilled' | 'failed';

const CORS_HEADERS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'GET,POST,OPTIONS',
  'access-control-allow-headers': 'content-type,authorization',
  'content-type': 'application/json; charset=utf-8',
};

function jsonResponse(statusCode: number, payload: unknown): HttpResponse {
  return {
    statusCode,
    headers: CORS_HEADERS,
    body: JSON.stringify(payload),
  };
}

function ok<T>(data: T): HttpResponse {
  return jsonResponse(200, {
    code: 0,
    message: 'ok',
    data,
  });
}

function fail(statusCode: number, message: string): HttpResponse {
  return jsonResponse(statusCode, {
    code: statusCode,
    message,
    data: null,
  });
}

function getHeader(event: Event, name: string): string {
  const headers = event.headers ?? {};
  const target = name.toLowerCase();
  const matched = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
  return matched?.[1] ?? '';
}

function getMethod(event: Event): string {
  return (event.httpMethod ?? event.method ?? 'POST').toUpperCase();
}

function getPath(event: Event): string {
  return event.rawPath ?? event.path ?? '';
}

function parseBody(event: Event): Record<string, unknown> {
  if (!event.body) {
    return {};
  }
  const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
  try {
    const parsed = JSON.parse(body) as unknown;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function assertOperatorToken(event: Event): void {
  const expected = process.env.OPERATOR_API_TOKEN;
  if (!expected || expected.length < 16) {
    throw new Error('缺少运营接口密钥配置：OPERATOR_API_TOKEN');
  }

  const authorization = getHeader(event, 'authorization');
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
  if (token !== expected) {
    const error = new Error('运营密钥不正确');
    (error as Error & { statusCode?: number }).statusCode = 401;
    throw error;
  }
}

function normalizeStatus(status?: string): OperatorTaskStatus {
  if (status === 'processing' || status === 'fulfilled' || status === 'failed') {
    return status;
  }
  return 'opening';
}

function matchTaskRoute(event: Event): { action: 'listTasks' | 'updateTask' | 'getVerificationCode'; orderNo?: string } | null {
  if (event.action === 'listTasks') {
    return { action: 'listTasks' };
  }
  if (event.action === 'updateTask' && event.orderNo) {
    return { action: 'updateTask', orderNo: event.orderNo };
  }
  if (event.action === 'getVerificationCode' && event.orderNo) {
    return { action: 'getVerificationCode', orderNo: event.orderNo };
  }

  const method = getMethod(event);
  const path = getPath(event).replace(/\/$/, '');
  if (method === 'GET' && /(?:^|\/)(?:operator\/)?tasks$/.test(path)) {
    return { action: 'listTasks' };
  }

  const codeMatched = path.match(/(?:^|\/)(?:operator\/)?tasks\/([^/]+)\/verification-code$/);
  if (method === 'GET' && codeMatched?.[1]) {
    return { action: 'getVerificationCode', orderNo: decodeURIComponent(codeMatched[1]) };
  }

  const matched = path.match(/(?:^|\/)(?:operator\/)?tasks\/([^/]+)$/);
  if (method === 'POST' && matched?.[1]) {
    return { action: 'updateTask', orderNo: decodeURIComponent(matched[1]) };
  }

  return null;
}

function isOrderVisibleForStatus(order: OrderRecord, status: OperatorTaskStatus): boolean {
  if (order.payStatus !== 'paid') {
    return false;
  }
  const fulfillmentStatus = order.fulfillmentStatus ?? 'opening';
  if (status === 'processing') {
    return fulfillmentStatus === 'opening' && Boolean(order.operatorProcessingAt);
  }
  if (status === 'opening') {
    return fulfillmentStatus === 'opening';
  }
  return fulfillmentStatus === status;
}

function sanitizeNote(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }
  return value.trim().slice(0, 200);
}

async function buildTask(order: OrderRecord & { _id: string }) {
  const user = await getUserById(order.userId);
  let password = '';
  if (user?.aiAccountPasswordEncrypted) {
    try {
      password = decryptAiAccountPassword(user.aiAccountPasswordEncrypted);
    } catch (error) {
      console.error(JSON.stringify({
        tag: 'operator.task.passwordDecryptFailed',
        orderNo: order.orderNo,
        userId: order.userId,
        message: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  return {
    orderNo: order.orderNo,
    productName: order.productName,
    planCode: order.planCode,
    planName: order.planName,
    amount: order.amount,
    paidAt: order.paidAt,
    fulfillmentStatus: order.fulfillmentStatus ?? 'opening',
    operatorProcessingAt: order.operatorProcessingAt,
    operatorNote: order.operatorNote ?? '',
    userId: order.userId,
    mobile: user?.mobile ?? '',
    nickname: user?.nickname ?? '',
    email: user?.aiAccountEmail ?? '',
    password,
  };
}

async function listTasks(event: Event): Promise<HttpResponse> {
  const status = normalizeStatus(event.queryStringParameters?.status ?? event.status);
  const result = await collection('orders')
    .where({
      payStatus: 'paid',
    })
    .get();
  const orders = (result.data as Array<OrderRecord & { _id: string }>)
    .filter((order) => isOrderVisibleForStatus(order, status))
    .sort((left, right) => (right.paidAt ?? right.createdAt) - (left.paidAt ?? left.createdAt))
    .slice(0, 50);
  const tasks = await Promise.all(orders.map(buildTask));
  return ok({ tasks });
}

async function updateTask(orderNo: string, body: Record<string, unknown>, event: Event): Promise<HttpResponse> {
  const status = normalizeStatus(String(body.status ?? event.status ?? ''));
  const note = sanitizeNote(body.note ?? event.note);
  const order = await getOrderByNo(orderNo);
  if (!order) {
    return fail(404, '订单不存在');
  }
  if (order.payStatus !== 'paid') {
    return fail(400, '订单未支付，不能处理开通');
  }

  const now = Date.now();
  if (status === 'fulfilled') {
    await fulfillPaidOrderMembership(order, { fulfilledAt: now });
    if (note) {
      await collection('orders').doc(order._id).update({
        data: {
          operatorNote: note,
          updatedAt: now,
        },
      });
    }
    return ok({ success: true, orderNo: order.orderNo, status: 'fulfilled' as FulfillmentStatus });
  }

  if (status === 'failed') {
    await collection('orders').doc(order._id).update({
      data: {
        fulfillmentStatus: 'failed',
        operatorFailedAt: now,
        operatorNote: note,
        updatedAt: now,
      },
    });
    return ok({ success: true, orderNo: order.orderNo, status: 'failed' as FulfillmentStatus });
  }

  await collection('orders').doc(order._id).update({
    data: {
      fulfillmentStatus: 'opening',
      operatorProcessingAt: now,
      operatorNote: note,
      updatedAt: now,
    },
  });
  return ok({ success: true, orderNo: order.orderNo, status: 'processing' });
}

async function getVerificationCode(orderNo: string): Promise<HttpResponse> {
  const order = await getOrderByNo(orderNo);
  if (!order) {
    return fail(404, '订单不存在');
  }

  const user = await getUserById(order.userId);
  if (!user?.aiAccountEmail) {
    return fail(404, '该订单用户暂未填写注册邮箱');
  }

  const codeRecord = await getLatestUnusedEmailVerificationCode(user.aiAccountEmail);
  if (!codeRecord) {
    return fail(404, '暂无可用验证码');
  }

  return ok({
    orderNo: order.orderNo,
    email: user.aiAccountEmail,
    code: codeRecord.code,
    provider: codeRecord.provider,
    subject: codeRecord.subject,
    receivedAt: codeRecord.receivedAt,
    expiresAt: codeRecord.expiresAt,
  });
}

export async function main(event: Event) {
  if (getMethod(event) === 'OPTIONS') {
    return {
      statusCode: 204,
      headers: CORS_HEADERS,
      body: '',
    };
  }

  try {
    assertOperatorToken(event);
    const route = matchTaskRoute(event);
    if (!route) {
      return fail(404, '接口不存在');
    }
    if (route.action === 'listTasks') {
      return listTasks(event);
    }
    if (route.action === 'getVerificationCode') {
      return getVerificationCode(route.orderNo as string);
    }
    return updateTask(route.orderNo as string, parseBody(event), event);
  } catch (error) {
    const statusCode = (error as Error & { statusCode?: number }).statusCode ?? 500;
    console.error(JSON.stringify({
      tag: 'operator.api.error',
      statusCode,
      message: error instanceof Error ? error.message : String(error),
    }));
    return fail(statusCode, error instanceof Error ? error.message : '运营接口异常');
  }
}
