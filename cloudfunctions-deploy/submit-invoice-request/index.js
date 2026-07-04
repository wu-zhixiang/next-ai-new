"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
const ACTIVE_INVOICE_STATUS = new Set(['submitted', 'processing', 'issued']);
function sanitizeText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function normalizeOrderNos(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return Array.from(new Set(value.map((item) => sanitizeText(item, 80)).filter(Boolean)));
}
function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
function fail(message) {
    throw new Error(message);
}
function errorResponse(message) {
    return {
        code: 400,
        message,
        data: null,
    };
}
function assertInvoiceableOrder(order, userId) {
    var _a, _b;
    const fulfillmentStatus = (_a = order.fulfillmentStatus) !== null && _a !== void 0 ? _a : (order.payStatus === 'paid' ? 'fulfilled' : 'pending');
    if (order.userId !== userId) {
        fail('订单不存在或不属于当前用户');
    }
    if (order.payStatus !== 'paid') {
        fail('只有已支付订单可以申请开发票');
    }
    if (fulfillmentStatus !== 'fulfilled') {
        fail('订单完成开通后才可以申请开发票');
    }
    if (ACTIVE_INVOICE_STATUS.has((_b = order.invoiceStatus) !== null && _b !== void 0 ? _b : 'none')) {
        fail('所选订单已有发票申请，请勿重复提交');
    }
}
async function submitInvoiceRequest(event = {}) {
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
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
    const result = await (0, db_1.collection)('orders').where({ orderNo: db_1._.in(orderNos) }).get();
    const orders = result.data;
    if (orders.length !== orderNos.length) {
        fail('部分订单不存在，请刷新后重试');
    }
    orders.forEach((order) => assertInvoiceableOrder(order, user._id));
    const now = Date.now();
    const invoiceNo = (0, utils_1.createOrderNo)('INV');
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
    const record = {
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
    await (0, db_1.ensureCollection)('invoiceRequests');
    await (0, db_1.collection)('invoiceRequests').add({ data: record });
    await (0, db_1.collection)('users').doc(user._id).update({
        data: {
            invoiceTitleType: titleType,
            invoiceTitle: title,
            invoiceTaxNo: titleType === 'company' ? taxNo : '',
            invoiceEmail: email,
            updatedAt: now,
        },
    });
    await Promise.all(orders.map((order) => (0, db_1.collection)('orders').doc(order._id).update({
        data: {
            invoiceStatus: 'submitted',
            invoiceNo,
            updatedAt: now,
        },
    })));
    return (0, utils_1.ok)({
        invoiceNo,
        status: record.status,
    });
}
async function main(event = {}) {
    try {
        return await submitInvoiceRequest(event);
    }
    catch (error) {
        return errorResponse(error instanceof Error ? error.message : '提交失败，请稍后再试');
    }
}
