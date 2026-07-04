"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
function isInvoiceableOrder(order) {
    var _a, _b;
    const fulfillmentStatus = (_a = order.fulfillmentStatus) !== null && _a !== void 0 ? _a : (order.payStatus === 'paid' ? 'fulfilled' : 'pending');
    const invoiceStatus = (_b = order.invoiceStatus) !== null && _b !== void 0 ? _b : 'none';
    return (order.payStatus === 'paid'
        && fulfillmentStatus === 'fulfilled'
        && Boolean(order.transactionId)
        && invoiceStatus !== 'submitted'
        && invoiceStatus !== 'processing'
        && invoiceStatus !== 'issued');
}
function serializeOrder(order) {
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
function serializeInvoiceRequest(record) {
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
async function main() {
    var _a, _b, _c, _d;
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        return (0, utils_1.ok)({ availableOrders: [], invoiceRequests: [], invoiceProfile: null });
    }
    const [orders, invoiceRequests] = await Promise.all([
        (0, db_1.listOrdersByUserId)(user._id),
        (0, db_1.listInvoiceRequestsByUserId)(user._id).catch(() => []),
    ]);
    return (0, utils_1.ok)({
        availableOrders: orders.filter(isInvoiceableOrder).map(serializeOrder),
        invoiceRequests: invoiceRequests.map(serializeInvoiceRequest),
        invoiceProfile: {
            titleType: (_a = user.invoiceTitleType) !== null && _a !== void 0 ? _a : 'personal',
            title: (_b = user.invoiceTitle) !== null && _b !== void 0 ? _b : '',
            taxNo: (_c = user.invoiceTaxNo) !== null && _c !== void 0 ? _c : '',
            email: (_d = user.invoiceEmail) !== null && _d !== void 0 ? _d : '',
        },
    });
}
