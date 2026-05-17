"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const orders_1 = require("./shared/orders");
const utils_1 = require("./shared/utils");
const wechat_1 = require("./shared/wechat");
function notifyXmlResponse(returnCode, returnMsg) {
    return {
        statusCode: 200,
        headers: {
            'content-type': 'text/xml',
        },
        body: (0, wechat_1.buildWechatPayNotifyResponse)(returnCode, returnMsg),
    };
}
async function main(event) {
    var _a, _b, _c;
    const notify = normalizeNotifyEvent(event);
    const orderNo = notify.orderNo || notify.outTradeNo || notify.out_trade_no;
    console.log(JSON.stringify({
        tag: 'wechatPay.v2.notify.received',
        callbackMode: notify.callbackMode,
        orderNo,
        returnCode: notify.return_code,
        resultCode: notify.result_code,
        transactionId: notify.transaction_id || notify.transactionId,
        totalFee: notify.total_fee,
        keys: Object.keys(notify.raw).sort(),
    }));
    if (!orderNo) {
        console.error(JSON.stringify({
            tag: 'wechatPay.v2.notify.missingOrderNo',
            callbackMode: notify.callbackMode,
            keys: Object.keys(notify.raw).sort(),
        }));
        return notifyXmlResponse('FAIL', '缺少订单号');
    }
    if (notify.callbackMode) {
        let signValid = false;
        try {
            signValid = (0, wechat_1.verifyWechatPayV2Sign)(notify.raw);
        }
        catch (error) {
            console.error(JSON.stringify({
                tag: 'wechatPay.v2.notify.signVerifyError',
                orderNo,
                message: error instanceof Error ? error.message : String(error),
            }));
            return notifyXmlResponse('FAIL', '验签配置错误');
        }
        if (!signValid) {
            console.error(JSON.stringify({ tag: 'wechatPay.v2.notify.signFailed', orderNo }));
            return notifyXmlResponse('FAIL', '签名错误');
        }
    }
    if ((notify.return_code && notify.return_code !== 'SUCCESS') || (notify.result_code && notify.result_code !== 'SUCCESS')) {
        return notify.callbackMode ? notifyXmlResponse('SUCCESS', 'OK') : (0, utils_1.ok)({ success: false, ignored: true });
    }
    const order = await (0, db_1.getOrderByNo)(orderNo);
    if (!order) {
        console.error(JSON.stringify({ tag: 'wechatPay.v2.notify.orderMissing', orderNo }));
        return notifyXmlResponse('FAIL', '订单不存在');
    }
    if (notify.total_fee && Number(notify.total_fee) !== (0, utils_1.toWechatPaymentAmount)(order.amount)) {
        console.error(JSON.stringify({
            tag: 'wechatPay.v2.notify.amountMismatch',
            orderNo,
            notifyTotalFee: notify.total_fee,
            orderTotalFee: (0, utils_1.toWechatPaymentAmount)(order.amount),
        }));
        return notifyXmlResponse('FAIL', '订单金额不匹配');
    }
    if (order.payStatus === 'paid') {
        return notify.callbackMode ? notifyXmlResponse('SUCCESS', 'OK') : (0, utils_1.ok)({ success: true, duplicated: true });
    }
    const now = (_a = notify.paidAt) !== null && _a !== void 0 ? _a : (0, utils_1.parseWechatPayTime)(notify.time_end);
    await (0, orders_1.markOrderPaidAndOpenMembership)(order, {
        transactionId: (_c = (_b = notify.transactionId) !== null && _b !== void 0 ? _b : notify.transaction_id) !== null && _c !== void 0 ? _c : '',
        paidAt: now,
    });
    console.log(JSON.stringify({ tag: 'wechatPay.v2.notify.applied', orderNo, userId: order.userId, productCode: order.productCode }));
    return notify.callbackMode ? notifyXmlResponse('SUCCESS', 'OK') : (0, utils_1.ok)({ success: true });
}
function normalizeNotifyEvent(event) {
    const httpBody = getHttpBody(event);
    const xml = httpBody.includes('<xml>') ? httpBody : '';
    if (xml) {
        const parsed = (0, wechat_1.parseWechatPayXml)(xml);
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
    const jsonBody = parseJsonBody(httpBody);
    const eventLike = {
        ...event,
        ...jsonBody,
    };
    return {
        raw: Object.fromEntries(Object.entries(eventLike)
            .filter(([, value]) => typeof value === 'string')
            .map(([key, value]) => [key, value])),
        callbackMode: Boolean(eventLike.outTradeNo || eventLike.out_trade_no || eventLike.return_code || eventLike.result_code),
        ...eventLike,
    };
}
function getHttpBody(event) {
    var _a, _b;
    const body = (_b = (_a = event.body) !== null && _a !== void 0 ? _a : event.rawBody) !== null && _b !== void 0 ? _b : '';
    if (!body) {
        return '';
    }
    return event.isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
}
function parseJsonBody(body) {
    if (!body) {
        return {};
    }
    try {
        const parsed = JSON.parse(body);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
    catch (_a) {
        return {};
    }
}
