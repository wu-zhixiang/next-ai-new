"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const wechat_pay_v3_1 = require("./shared/wechat-pay-v3");
function normalizeFapiaoInformation(value) {
    if (Array.isArray(value)) {
        return value;
    }
    if (value && typeof value === 'object') {
        return [value];
    }
    return [];
}
function jsonResponse(statusCode, body) {
    return {
        statusCode,
        headers: {
            'content-type': 'application/json; charset=utf-8',
        },
        body: body === undefined ? '' : JSON.stringify(body),
    };
}
function normalizeBody(event) {
    var _a, _b;
    const raw = (_b = (_a = event.rawBody) !== null && _a !== void 0 ? _a : event.body) !== null && _b !== void 0 ? _b : '';
    return event.isBase64Encoded ? Buffer.from(raw, 'base64').toString('utf8') : raw;
}
function parseNotify(event, body) {
    if (event.resource) {
        return event;
    }
    if (!body) {
        return event;
    }
    const parsed = JSON.parse(body);
    return parsed && typeof parsed === 'object' ? parsed : event;
}
async function applyIssuedResource(resource) {
    var _a;
    const fapiaoApplyId = resource.fapiao_apply_id;
    if (!fapiaoApplyId) {
        throw new Error('回调缺少发票申请单号');
    }
    const invoice = await (0, db_1.getInvoiceRequestByFapiaoApplyId)(fapiaoApplyId);
    if (!invoice) {
        throw new Error('发票申请不存在');
    }
    if (invoice.status === 'issued') {
        return;
    }
    const fapiaoInformation = normalizeFapiaoInformation(resource.fapiao_information);
    const matched = (_a = fapiaoInformation.find((item) => item.fapiao_id === invoice.fapiaoId)) !== null && _a !== void 0 ? _a : fapiaoInformation[0];
    if (!matched) {
        throw new Error('回调缺少发票信息');
    }
    const now = Date.now();
    const issued = matched.fapiao_status === 'ISSUED';
    const status = issued ? 'issued' : matched.fapiao_status === 'ISSUE_FAILED' ? 'failed' : 'processing';
    await (0, db_1.collection)('invoiceRequests').doc(invoice._id).update({
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
        const result = await (0, db_1.collection)('orders').where({ orderNo }).get();
        const order = result.data[0];
        if (!(order === null || order === void 0 ? void 0 : order._id)) {
            return;
        }
        await (0, db_1.collection)('orders').doc(order._id).update({
            data: {
                invoiceStatus: status,
                invoiceNo: invoice.invoiceNo,
                updatedAt: now,
            },
        });
    }));
}
async function main(event) {
    var _a;
    const body = normalizeBody(event);
    try {
        const config = (0, wechat_pay_v3_1.getWechatPayV3Config)();
        const headers = (_a = event.headers) !== null && _a !== void 0 ? _a : {};
        const serial = (0, wechat_pay_v3_1.getWechatPayHeader)(headers, 'Wechatpay-Serial');
        const signature = (0, wechat_pay_v3_1.getWechatPayHeader)(headers, 'Wechatpay-Signature');
        const timestamp = (0, wechat_pay_v3_1.getWechatPayHeader)(headers, 'Wechatpay-Timestamp');
        const nonce = (0, wechat_pay_v3_1.getWechatPayHeader)(headers, 'Wechatpay-Nonce');
        if (!(0, wechat_pay_v3_1.verifyWechatPayV3Signature)({ timestamp, nonce, body, signature, serial, config })) {
            return jsonResponse(401, { code: 'FAIL', message: '签名验证失败' });
        }
        const notify = parseNotify(event, body);
        if (notify.event_type !== 'FAPIAO.ISSUED' || !notify.resource) {
            return jsonResponse(204);
        }
        const resource = (0, wechat_pay_v3_1.decryptWechatPayResource)(notify.resource);
        await applyIssuedResource(resource);
        return jsonResponse(204);
    }
    catch (error) {
        console.error(JSON.stringify({
            tag: 'wechatPay.fapiao.notify.failed',
            message: error instanceof Error ? error.message : String(error),
        }));
        return jsonResponse(500, { code: 'FAIL', message: error instanceof Error ? error.message : '处理失败' });
    }
}
