import { collection, ensureCollection, getUserByOpenId, _ } from '../shared/db';
import { createOrderNo, ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';
import type { InvoiceRequestRecord, OrderRecord } from '../shared/types';

interface Event {
  orderNos?: unknown;
  titleType?: unknown;
  title?: unknown;
  taxNo?: unknown;
  email?: unknown;
}

const ACTIVE_INVOICE_STATUS = new Set(['submitted', 'processing', 'issued']);

function sanitizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeOrderNos(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((item) => sanitizeText(item, 80)).filter(Boolean)));
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function fail(message: string): never {
  throw new Error(message);
}

function errorResponse(message: string) {
  return {
    code: 400,
    message,
    data: null,
  };
}

function assertInvoiceableOrder(order: OrderRecord, userId: string): void {
  const fulfillmentStatus = order.fulfillmentStatus ?? (order.payStatus === 'paid' ? 'fulfilled' : 'pending');
  if (order.userId !== userId) {
    fail('订单不存在或不属于当前用户');
  }
  if (order.payStatus !== 'paid') {
    fail('只有已支付订单可以申请开发票');
  }
  if (fulfillmentStatus !== 'fulfilled') {
    fail('订单完成开通后才可以申请开发票');
  }
  if (ACTIVE_INVOICE_STATUS.has(order.invoiceStatus ?? 'none')) {
    fail('所选订单已有发票申请，请勿重复提交');
  }
}

async function submitInvoiceRequest(event: Event = {}) {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    fail('请先登录后再申请开发票');
  }

  const orderNos = normalizeOrderNos(event.orderNos);
  const titleType = event.titleType === 'company' ? 'company' : 'personal';
  const title = sanitizeText(event.title, 100);
  const taxNo = sanitizeText(event.taxNo, 60).toUpperCase();
  const email = sanitizeText(event.email, 100).toLowerCase();

  if (orderNos.length === 0) {
    fail('请选择需要开票的订单');
  }
  if (!title) {
    fail('请填写发票抬头');
  }
  if (titleType === 'company' && !taxNo) {
    fail('企业发票请填写纳税人识别号');
  }
  if (!email || !isValidEmail(email)) {
    fail('请填写正确的接收邮箱');
  }

  const result = await collection('orders').where({ orderNo: _.in(orderNos) }).get();
  const orders = result.data as Array<OrderRecord & { _id: string }>;
  if (orders.length !== orderNos.length) {
    fail('部分订单不存在，请刷新后重试');
  }

  orders.forEach((order) => assertInvoiceableOrder(order, user._id));

  const now = Date.now();
  const invoiceNo = createOrderNo('INV');
  const invoiceOrders = orders.map((order) => ({
    orderNo: order.orderNo,
    productCode: order.productCode,
    productName: order.productName,
    planCode: order.planCode,
    planName: order.planName,
    amount: order.amount,
    paidAt: order.paidAt,
    fulfilledAt: order.fulfilledAt,
  }));
  const amount = invoiceOrders.reduce((sum, order) => sum + order.amount, 0);
  const record: InvoiceRequestRecord = {
    invoiceNo,
    userId: user._id,
    openid: user.openid,
    scene: 'WITHOUT_WECHATPAY',
    orderNos: invoiceOrders.map((order) => order.orderNo),
    orders: invoiceOrders,
    amount,
    titleType,
    title,
    taxNo: titleType === 'company' ? taxNo : undefined,
    email,
    status: 'submitted',
    createdAt: now,
    updatedAt: now,
  };

  await ensureCollection('invoiceRequests');
  await collection('invoiceRequests').add({ data: record });
  await collection('users').doc(user._id).update({
    data: {
      invoiceTitleType: titleType,
      invoiceTitle: title,
      invoiceTaxNo: titleType === 'company' ? taxNo : '',
      invoiceEmail: email,
      updatedAt: now,
    },
  });
  await Promise.all(orders.map((order) => collection('orders').doc(order._id).update({
    data: {
      invoiceStatus: 'submitted',
      invoiceNo,
      updatedAt: now,
    },
  })));

  return ok({
    invoiceNo,
    status: record.status,
  });
}

export async function main(event: Event = {}) {
  try {
    return await submitInvoiceRequest(event);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : '提交失败，请稍后再试');
  }
}
