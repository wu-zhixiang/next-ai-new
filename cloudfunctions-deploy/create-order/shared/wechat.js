"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WechatPayV2OrderError = void 0;
exports.getWechatPayConfig = getWechatPayConfig;
exports.getWechatPayV2Config = getWechatPayV2Config;
exports.getWechatPayV2ApiKey = getWechatPayV2ApiKey;
exports.parseWechatPayXml = parseWechatPayXml;
exports.buildWechatPayNotifyResponse = buildWechatPayNotifyResponse;
exports.verifyWechatPayV2Sign = verifyWechatPayV2Sign;
exports.createWechatPayV2Order = createWechatPayV2Order;
exports.createWechatVirtualPaymentOrder = createWechatVirtualPaymentOrder;
exports.getWechatPhoneNumber = getWechatPhoneNumber;
exports.createWechatPayOrder = createWechatPayOrder;
const wx_server_sdk_1 = __importDefault(require("wx-server-sdk"));
const crypto_1 = __importDefault(require("crypto"));
const https_1 = __importDefault(require("https"));
const constants_1 = require("./constants");
const utils_1 = require("./utils");
function normalizeWechatPaymentParams(result) {
    var _a, _b;
    const candidate = ((_a = result.payment) !== null && _a !== void 0 ? _a : result.payInfo);
    if (!candidate) {
        return null;
    }
    const packageValue = (_b = candidate.package) !== null && _b !== void 0 ? _b : candidate.packageVal;
    if (!candidate.timeStamp || !candidate.nonceStr || !packageValue || !candidate.signType || !candidate.paySign) {
        return null;
    }
    return {
        appId: candidate.appId,
        timeStamp: candidate.timeStamp,
        nonceStr: candidate.nonceStr,
        package: packageValue,
        signType: candidate.signType,
        paySign: candidate.paySign,
    };
}
function formatUnifiedOrderError(result) {
    var _a, _b;
    const keys = Object.keys(result || {}).sort().join(',') || 'none';
    const parts = [
        `returnCode=${(_a = result.returnCode) !== null && _a !== void 0 ? _a : 'unknown'}`,
        `resultCode=${(_b = result.resultCode) !== null && _b !== void 0 ? _b : 'unknown'}`,
    ];
    if (result.returnMsg) {
        parts.push(`returnMsg=${result.returnMsg}`);
    }
    if (result.errCode) {
        parts.push(`errCode=${result.errCode}`);
    }
    if (result.errCodeDes) {
        parts.push(`errCodeDes=${result.errCodeDes}`);
    }
    parts.push(`keys=${keys}`);
    return parts.join('; ');
}
function getWechatPayConfig() {
    const envId = process.env.WX_PAY_ENV_ID || process.env.TCB_ENV || process.env.SCF_NAMESPACE || '';
    const notifyFunctionName = process.env.WX_PAY_NOTIFY_FUNCTION || 'pay-notify';
    const spbillCreateIp = process.env.WX_PAY_SPBILL_CREATE_IP || '127.0.0.1';
    if (!envId) {
        throw new Error('缺少支付环境配置：请设置 WX_PAY_ENV_ID 或云函数环境 ID');
    }
    return {
        envId,
        notifyFunctionName,
        spbillCreateIp,
    };
}
function getWechatPayV2Config() {
    const appid = process.env.WX_PAY_APPID || '';
    const mchId = process.env.WX_PAY_MCH_ID || '';
    const apiKey = process.env.WX_PAY_API_KEY || '';
    const notifyUrl = process.env.WX_PAY_NOTIFY_URL || '';
    const spbillCreateIp = process.env.WX_PAY_SPBILL_CREATE_IP || '127.0.0.1';
    const missing = [
        !appid && 'WX_PAY_APPID',
        !mchId && 'WX_PAY_MCH_ID',
        !apiKey && 'WX_PAY_API_KEY',
        !notifyUrl && 'WX_PAY_NOTIFY_URL',
    ].filter(Boolean);
    if (missing.length > 0) {
        throw new Error(`缺少微信支付 V2 配置：${missing.join(', ')}`);
    }
    return {
        appid,
        mchId,
        apiKey,
        notifyUrl,
        spbillCreateIp,
    };
}
function getWechatPayV2ApiKey() {
    const apiKey = process.env.WX_PAY_API_KEY || '';
    if (!apiKey) {
        throw new Error('缺少微信支付 V2 配置：WX_PAY_API_KEY');
    }
    return apiKey;
}
function createNonceStr() {
    return crypto_1.default.randomBytes(16).toString('hex');
}
function escapeXml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
function signWechatPayV2(params, apiKey) {
    const payload = Object.entries(params)
        .filter(([key, value]) => key !== 'sign' && value !== undefined && value !== '')
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
    return crypto_1.default
        .createHash('md5')
        .update(`${payload}&key=${apiKey}`, 'utf8')
        .digest('hex')
        .toUpperCase();
}
function buildWechatPayXml(params) {
    const body = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== '')
        .map(([key, value]) => `<${key}>${escapeXml(String(value))}</${key}>`)
        .join('');
    return `<xml>${body}</xml>`;
}
function parseWechatPayXml(xml) {
    var _a, _b;
    const result = {};
    const content = xml.trim().replace(/^<xml>/, '').replace(/<\/xml>$/, '');
    const pattern = /<([a-zA-Z0-9_]+)>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/\1>/g;
    let match;
    while ((match = pattern.exec(content))) {
        result[match[1]] = (_b = (_a = match[2]) !== null && _a !== void 0 ? _a : match[3]) !== null && _b !== void 0 ? _b : '';
    }
    return result;
}
function postWechatPayXml(url, xml) {
    return new Promise((resolve, reject) => {
        const request = https_1.default.request(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml',
                'Content-Length': Buffer.byteLength(xml),
            },
        }, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            response.on('end', () => resolve({
                statusCode: response.statusCode,
                body: Buffer.concat(chunks).toString('utf8'),
            }));
        });
        request.on('error', reject);
        request.write(xml);
        request.end();
    });
}
function getJson(url) {
    return new Promise((resolve, reject) => {
        https_1.default
            .get(url, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            response.on('end', () => {
                try {
                    resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
                }
                catch (error) {
                    reject(error);
                }
            });
        })
            .on('error', reject);
    });
}
function buildWechatPayNotifyResponse(returnCode, returnMsg) {
    return buildWechatPayXml({
        return_code: returnCode,
        return_msg: returnMsg,
    });
}
function verifyWechatPayV2Sign(params, apiKey = getWechatPayV2ApiKey()) {
    if (!params.sign) {
        return false;
    }
    return signWechatPayV2(params, apiKey) === params.sign;
}
class WechatPayV2OrderError extends Error {
    constructor(message, errCode, errCodeDes) {
        super(message);
        this.errCode = errCode;
        this.errCodeDes = errCodeDes;
        this.name = 'WechatPayV2OrderError';
    }
}
exports.WechatPayV2OrderError = WechatPayV2OrderError;
async function createWechatPayV2Order(order, openid) {
    var _a, _b, _c, _d, _e, _f;
    const config = getWechatPayV2Config();
    const requestParams = {
        appid: config.appid,
        mch_id: config.mchId,
        nonce_str: createNonceStr(),
        body: `${order.productName || constants_1.DEFAULT_PRODUCT_NAME}-${order.planName}`,
        out_trade_no: order.orderNo,
        total_fee: (0, utils_1.toWechatPaymentAmount)(order.amount),
        spbill_create_ip: config.spbillCreateIp,
        notify_url: config.notifyUrl,
        trade_type: 'JSAPI',
        openid,
        attach: JSON.stringify({
            orderNo: order.orderNo,
            productCode: order.productCode,
            planCode: order.planCode,
            userId: order.userId,
        }),
    };
    const sign = signWechatPayV2(requestParams, config.apiKey);
    const httpResponse = await postWechatPayXml('https://api.mch.weixin.qq.com/pay/unifiedorder', buildWechatPayXml({
        ...requestParams,
        sign,
    }));
    const response = parseWechatPayXml(httpResponse.body);
    const rawResponse = httpResponse.body.replace(/\s+/g, ' ').slice(0, 300);
    console.log(JSON.stringify({
        tag: 'wechatPay.v2.unifiedorder',
        orderNo: order.orderNo,
        appid: config.appid,
        mchId: config.mchId,
        notifyUrl: config.notifyUrl,
        openidPrefix: openid.slice(0, 6),
        totalFee: requestParams.total_fee,
        statusCode: httpResponse.statusCode,
        response,
        rawResponse,
    }));
    if (response.return_code !== 'SUCCESS' || response.result_code !== 'SUCCESS' || !response.prepay_id) {
        throw new WechatPayV2OrderError(`微信支付 V2 统一下单失败: return_code=${(_a = response.return_code) !== null && _a !== void 0 ? _a : 'unknown'}; result_code=${(_b = response.result_code) !== null && _b !== void 0 ? _b : 'unknown'}; return_msg=${(_c = response.return_msg) !== null && _c !== void 0 ? _c : ''}; err_code=${(_d = response.err_code) !== null && _d !== void 0 ? _d : ''}; err_code_des=${(_e = response.err_code_des) !== null && _e !== void 0 ? _e : ''}; http_status=${(_f = httpResponse.statusCode) !== null && _f !== void 0 ? _f : 'unknown'}; raw=${rawResponse}`, response.err_code, response.err_code_des);
    }
    const timeStamp = Math.floor(Date.now() / 1000).toString();
    const nonceStr = createNonceStr();
    const paymentPackage = `prepay_id=${response.prepay_id}`;
    const payment = {
        appId: config.appid,
        timeStamp,
        nonceStr,
        package: paymentPackage,
        signType: 'MD5',
        paySign: signWechatPayV2({
            appId: config.appid,
            timeStamp,
            nonceStr,
            package: paymentPackage,
            signType: 'MD5',
        }, config.apiKey),
        prepayId: response.prepay_id,
    };
    return payment;
}
function getWechatVirtualPayConfig() {
    const appid = process.env.WX_PAY_APPID || process.env.WX_APPID || '';
    const appSecret = process.env.WX_APP_SECRET || '';
    const offerId = process.env.WX_VIRTUAL_PAY_OFFER_ID || '';
    const appKey = process.env.WX_VIRTUAL_PAY_APP_KEY || '';
    const env = process.env.WX_VIRTUAL_PAY_ENV === '1' ? 1 : 0;
    const missing = [
        !appid && 'WX_PAY_APPID 或 WX_APPID',
        !appSecret && 'WX_APP_SECRET',
        !offerId && 'WX_VIRTUAL_PAY_OFFER_ID',
        !appKey && 'WX_VIRTUAL_PAY_APP_KEY',
    ].filter(Boolean);
    if (missing.length > 0) {
        throw new Error(`缺少小程序虚拟支付配置：${missing.join(', ')}`);
    }
    return {
        appid,
        appSecret,
        offerId,
        appKey,
        env,
        currencyType: 'CNY',
        mode: 'short_series_goods',
    };
}
function getVirtualPaymentProductId(order) {
    const key = `WX_VIRTUAL_PAY_PRODUCT_ID_${order.planCode.replace(/[^a-zA-Z0-9]/g, '_').toUpperCase()}`;
    return process.env[key] || process.env.WX_VIRTUAL_PAY_PRODUCT_ID || order.planCode;
}
function signVirtualPaymentPayload(key, payload) {
    return crypto_1.default.createHmac('sha256', key).update(payload, 'utf8').digest('hex');
}
async function getWechatSessionKey(jsCode, config) {
    var _a, _b;
    if (!jsCode) {
        throw new Error('缺少微信登录 code，无法生成虚拟支付用户签名');
    }
    const url = `https://api.weixin.qq.com/sns/jscode2session?appid=${encodeURIComponent(config.appid)}&secret=${encodeURIComponent(config.appSecret)}&js_code=${encodeURIComponent(jsCode)}&grant_type=authorization_code`;
    const result = await getJson(url);
    if (!result.session_key) {
        throw new Error(`微信登录态换取失败：${(_a = result.errcode) !== null && _a !== void 0 ? _a : 'unknown'} ${(_b = result.errmsg) !== null && _b !== void 0 ? _b : ''}`.trim());
    }
    return result.session_key;
}
async function createWechatVirtualPaymentOrder(order, jsCode) {
    const config = getWechatVirtualPayConfig();
    const sessionKey = await getWechatSessionKey(jsCode, config);
    const signData = {
        offerId: config.offerId,
        buyQuantity: 1,
        env: config.env,
        currencyType: config.currencyType,
        productId: getVirtualPaymentProductId(order),
        goodsPrice: (0, utils_1.toWechatPaymentAmount)(order.amount),
        outTradeNo: order.orderNo,
        attach: JSON.stringify({
            orderNo: order.orderNo,
            productCode: order.productCode,
            planCode: order.planCode,
            userId: order.userId,
        }),
    };
    const signDataString = JSON.stringify(signData);
    return {
        signData: signDataString,
        paySig: signVirtualPaymentPayload(config.appKey, `requestVirtualPayment&${signDataString}`),
        signature: signVirtualPaymentPayload(sessionKey, signDataString),
        mode: config.mode,
    };
}
async function getWechatPhoneNumber(code) {
    var _a, _b, _c, _d;
    const sdk = wx_server_sdk_1.default;
    const phoneApi = (_a = sdk.openapi) === null || _a === void 0 ? void 0 : _a.phonenumber;
    if (!phoneApi) {
        throw new Error('当前云函数环境未启用 openapi.phonenumber.getPhoneNumber');
    }
    const result = await phoneApi.getPhoneNumber({ code });
    const phoneInfo = (_b = result.phone_info) !== null && _b !== void 0 ? _b : result.phoneInfo;
    const mobile = (_d = (_c = phoneInfo === null || phoneInfo === void 0 ? void 0 : phoneInfo.purePhoneNumber) !== null && _c !== void 0 ? _c : phoneInfo === null || phoneInfo === void 0 ? void 0 : phoneInfo.phoneNumber) !== null && _d !== void 0 ? _d : '';
    if (!mobile) {
        throw new Error('微信未返回手机号');
    }
    return mobile;
}
async function createWechatPayOrder(order) {
    const sdk = wx_server_sdk_1.default;
    const cloudPay = sdk.cloudPay;
    if (!cloudPay) {
        throw new Error('当前云函数环境未启用 cloud.cloudPay.unifiedOrder');
    }
    const config = getWechatPayConfig();
    const result = await cloudPay.unifiedOrder({
        body: `${order.productName || constants_1.DEFAULT_PRODUCT_NAME}-${order.planName}`,
        outTradeNo: order.orderNo,
        totalFee: (0, utils_1.toWechatPaymentAmount)(order.amount),
        envId: config.envId,
        functionName: config.notifyFunctionName,
        spbillCreateIp: config.spbillCreateIp,
        attach: JSON.stringify({
            orderNo: order.orderNo,
            productCode: order.productCode,
            planCode: order.planCode,
            userId: order.userId,
        }),
    });
    console.log(JSON.stringify({
        tag: 'cloudPay.unifiedOrder',
        orderNo: order.orderNo,
        productCode: order.productCode,
        totalFee: (0, utils_1.toWechatPaymentAmount)(order.amount),
        result,
    }));
    const payment = normalizeWechatPaymentParams(result);
    if (!payment) {
        throw new Error(`统一下单未返回可用支付参数: ${formatUnifiedOrderError(result)}`);
    }
    return payment;
}
