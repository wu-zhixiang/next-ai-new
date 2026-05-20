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
function notifyTextResponse(body) {
    return body;
}
async function main(event) {
    var _a, _b, _c;
    const notify = normalizeNotifyEvent(event);
    if (notify.echostr) {
        return notifyTextResponse(notify.echostr);
    }
    if (isVirtualPaymentNotify(notify)) {
        return handleVirtualPaymentNotify(notify);
    }
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
    await (0, orders_1.markOrderPaidAndStartOpening)(order, {
        transactionId: (_c = (_b = notify.transactionId) !== null && _b !== void 0 ? _b : notify.transaction_id) !== null && _c !== void 0 ? _c : '',
        paidAt: now,
    });
    console.log(JSON.stringify({ tag: 'wechatPay.v2.notify.applied', orderNo, userId: order.userId, productCode: order.productCode }));
    return notify.callbackMode ? notifyXmlResponse('SUCCESS', 'OK') : (0, utils_1.ok)({ success: true });
}
async function handleVirtualPaymentNotify(notify) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const orderNo = notify.OutTradeNo || notify.orderNo || notify.outTradeNo || notify.out_trade_no;
    console.log(JSON.stringify({
        tag: 'wechatVirtualPay.notify.received',
        event: notify.Event,
        orderNo,
        openIdPrefix: (_a = notify.OpenId) === null || _a === void 0 ? void 0 : _a.slice(0, 6),
        productId: (_b = notify.GoodsInfo) === null || _b === void 0 ? void 0 : _b.ProductId,
        actualPrice: (_c = notify.GoodsInfo) === null || _c === void 0 ? void 0 : _c.ActualPrice,
        transactionId: (_d = notify.WeChatPayInfo) === null || _d === void 0 ? void 0 : _d.TransactionId,
        keys: Object.keys(notify.raw).sort(),
    }));
    if (!orderNo) {
        console.error(JSON.stringify({ tag: 'wechatVirtualPay.notify.missingOrderNo', event: notify.Event }));
        return notifyTextResponse('fail');
    }
    const order = await (0, db_1.getOrderByNo)(orderNo);
    if (!order) {
        console.error(JSON.stringify({ tag: 'wechatVirtualPay.notify.orderMissing', orderNo }));
        return notifyTextResponse('fail');
    }
    if (typeof ((_e = notify.GoodsInfo) === null || _e === void 0 ? void 0 : _e.ActualPrice) === 'number' &&
        notify.GoodsInfo.ActualPrice !== (0, utils_1.toWechatPaymentAmount)(order.amount)) {
        console.error(JSON.stringify({
            tag: 'wechatVirtualPay.notify.amountMismatch',
            orderNo,
            notifyActualPrice: notify.GoodsInfo.ActualPrice,
            orderTotalFee: (0, utils_1.toWechatPaymentAmount)(order.amount),
        }));
        return notifyTextResponse('fail');
    }
    if (order.payStatus === 'paid') {
        return notifyTextResponse('success');
    }
    await (0, orders_1.markOrderPaidAndStartOpening)(order, {
        transactionId: (_h = (_g = (_f = notify.WeChatPayInfo) === null || _f === void 0 ? void 0 : _f.TransactionId) !== null && _g !== void 0 ? _g : notify.transactionId) !== null && _h !== void 0 ? _h : '',
        paidAt: ((_j = notify.WeChatPayInfo) === null || _j === void 0 ? void 0 : _j.PaidTime) ? notify.WeChatPayInfo.PaidTime * 1000 : Date.now(),
    });
    console.log(JSON.stringify({ tag: 'wechatVirtualPay.notify.applied', orderNo, userId: order.userId, productCode: order.productCode }));
    return notifyTextResponse('success');
}
function isVirtualPaymentNotify(notify) {
    return notify.Event === 'xpay_goods_deliver_notify' || notify.Event === 'xpay_coin_pay_notify';
}
function normalizeNotifyEvent(event) {
    var _a;
    const httpBody = getHttpBody(event);
    const xml = httpBody.includes('<xml>') ? httpBody : '';
    if (xml) {
        const parsed = (0, wechat_1.parseWechatPayXml)(xml);
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
    const payload = parsePayload((_a = event.Payload) !== null && _a !== void 0 ? _a : jsonBody.Payload);
    const eventLike = {
        ...event,
        ...jsonBody,
        ...payload,
    };
    return {
        raw: Object.fromEntries(Object.entries(eventLike)
            .filter(([, value]) => typeof value === 'string' || typeof value === 'number')
            .map(([key, value]) => [key, String(value)])),
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
function parsePayload(payload) {
    if (typeof payload !== 'string' || !payload) {
        return {};
    }
    try {
        const parsed = JSON.parse(payload);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
    catch (_a) {
        return {};
    }
}
