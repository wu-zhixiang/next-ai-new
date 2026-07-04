import { getUserByOpenId, listInvoiceRequestsByUserId, listOrdersByUserId } from '../shared/db';
import { ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';
import type { InvoiceRequestRecord, OrderRecord } from '../shared/types';

const ACTIVE_INVOICE_STATUS = new Set(['submitted', 'processing', 'issued']);

function isInvoiceableOrder(order: OrderRecord, invoicedOrderNos: Set<string>): boolean {
  const fulfillmentStatus = order.fulfillmentStatus ?? (order.payStatus === 'paid' ? 'fulfilled' : 'pending');
  const invoiceStatus = order.invoiceStatus ?? 'none';
  return (
    order.payStatus === 'paid'
    && fulfillmentStatus === 'fulfilled'
    && Boolean(order.transactionId)
    && !ACTIVE_INVOICE_STATUS.has(invoiceStatus)
    && !invoicedOrderNos.has(order.orderNo)
  );
}

function serializeOrder(order: OrderRecord) {
  return {
    orderNo: order.orderNo,
    productCode: order.productCode,
    productName: order.productName,
    planCode: order.planCode,
    planName: order.planName,
    amount: order.amount,
    paidAt: order.paidAt,
    fulfilledAt: order.fulfilledAt,
  };
}

function serializeInvoiceRequest(record: InvoiceRequestRecord) {
  return {
    invoiceNo: record.invoiceNo,
    scene: record.scene,
    fapiaoApplyId: record.fapiaoApplyId,
    fapiaoId: record.fapiaoId,
    wechatTransactionId: record.wechatTransactionId,
    orderNos: record.orderNos,
    orders: record.orders,
    amount: record.amount,
    titleType: record.titleType,
    title: record.title,
    taxNo: record.taxNo,
    email: record.email,
    status: record.status,
    operatorNote: record.operatorNote,
    rejectReason: record.rejectReason,
    failReason: record.failReason,
    wechatFapiaoStatus: record.wechatFapiaoStatus,
    cardOpenid: record.cardOpenid,
    invoiceCode: record.invoiceCode,
    invoiceNumber: record.invoiceNumber,
    invoiceNoFromWechat: record.invoiceNoFromWechat,
    invoiceFileUrl: record.invoiceFileUrl,
    invoiceFileId: record.invoiceFileId,
    issuedAt: record.issuedAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function main() {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    return ok({ availableOrders: [], invoiceRequests: [], invoiceProfile: null });
  }

  const [orders, invoiceRequests] = await Promise.all([
    listOrdersByUserId(user._id),
    listInvoiceRequestsByUserId(user._id).catch(() => []),
  ]);
  const invoicedOrderNos = new Set(
    invoiceRequests
      .filter((request) => ACTIVE_INVOICE_STATUS.has(request.status))
      .flatMap((request) => request.orderNos),
  );

  return ok({
    availableOrders: orders.filter((order) => isInvoiceableOrder(order, invoicedOrderNos)).map(serializeOrder),
    invoiceRequests: invoiceRequests.map(serializeInvoiceRequest),
    invoiceProfile: {
      titleType: user.invoiceTitleType ?? 'personal',
      title: user.invoiceTitle ?? '',
      taxNo: user.invoiceTaxNo ?? '',
      email: user.invoiceEmail ?? '',
    },
  });
}
