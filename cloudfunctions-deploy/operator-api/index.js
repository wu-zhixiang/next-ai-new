"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const ai_account_1 = require("./shared/ai-account");
const db_1 = require("./shared/db");
const orders_1 = require("./shared/orders");
const CORS_HEADERS = {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'content-type': 'application/json; charset=utf-8',
};
function jsonResponse(statusCode, payload) {
    return {
        statusCode,
        headers: CORS_HEADERS,
        body: JSON.stringify(payload),
    };
}
function ok(data) {
    return jsonResponse(200, {
        code: 0,
        message: 'ok',
        data,
    });
}
function fail(statusCode, message) {
    return jsonResponse(statusCode, {
        code: statusCode,
        message,
        data: null,
    });
}
function getHeader(event, name) {
    var _a, _b;
    const headers = (_a = event.headers) !== null && _a !== void 0 ? _a : {};
    const target = name.toLowerCase();
    const matched = Object.entries(headers).find(([key]) => key.toLowerCase() === target);
    return (_b = matched === null || matched === void 0 ? void 0 : matched[1]) !== null && _b !== void 0 ? _b : '';
}
function getMethod(event) {
    var _a, _b;
    return ((_b = (_a = event.httpMethod) !== null && _a !== void 0 ? _a : event.method) !== null && _b !== void 0 ? _b : 'POST').toUpperCase();
}
function getPath(event) {
    var _a, _b;
    return (_b = (_a = event.rawPath) !== null && _a !== void 0 ? _a : event.path) !== null && _b !== void 0 ? _b : '';
}
function parseBody(event) {
    if (!event.body) {
        return {};
    }
    const body = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    try {
        const parsed = JSON.parse(body);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
    catch (_a) {
        return {};
    }
}
function assertOperatorToken(event) {
    const expected = process.env.OPERATOR_API_TOKEN;
    if (!expected || expected.length < 16) {
        throw new Error('缺少运营接口密钥配置：OPERATOR_API_TOKEN');
    }
    const authorization = getHeader(event, 'authorization');
    const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    if (token !== expected) {
        const error = new Error('运营密钥不正确');
        error.statusCode = 401;
        throw error;
    }
}
function normalizeStatus(status) {
    if (status === 'processing' || status === 'fulfilled' || status === 'failed') {
        return status;
    }
    return 'opening';
}
function matchTaskRoute(event) {
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
    if (method === 'GET' && (codeMatched === null || codeMatched === void 0 ? void 0 : codeMatched[1])) {
        return { action: 'getVerificationCode', orderNo: decodeURIComponent(codeMatched[1]) };
    }
    const matched = path.match(/(?:^|\/)(?:operator\/)?tasks\/([^/]+)$/);
    if (method === 'POST' && (matched === null || matched === void 0 ? void 0 : matched[1])) {
        return { action: 'updateTask', orderNo: decodeURIComponent(matched[1]) };
    }
    return null;
}
function isOrderVisibleForStatus(order, status) {
    var _a;
    if (order.payStatus !== 'paid') {
        return false;
    }
    const fulfillmentStatus = (_a = order.fulfillmentStatus) !== null && _a !== void 0 ? _a : 'opening';
    if (status === 'processing') {
        return fulfillmentStatus === 'opening' && Boolean(order.operatorProcessingAt);
    }
    if (status === 'opening') {
        return fulfillmentStatus === 'opening';
    }
    return fulfillmentStatus === status;
}
function sanitizeNote(value) {
    if (typeof value !== 'string') {
        return '';
    }
    return value.trim().slice(0, 200);
}
async function buildTask(order) {
    var _a, _b, _c, _d, _e;
    const user = await (0, db_1.getUserById)(order.userId);
    let password = '';
    if (user === null || user === void 0 ? void 0 : user.aiAccountPasswordEncrypted) {
        try {
            password = (0, ai_account_1.decryptAiAccountPassword)(user.aiAccountPasswordEncrypted);
        }
        catch (error) {
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
        fulfillmentStatus: (_a = order.fulfillmentStatus) !== null && _a !== void 0 ? _a : 'opening',
        operatorProcessingAt: order.operatorProcessingAt,
        operatorNote: (_b = order.operatorNote) !== null && _b !== void 0 ? _b : '',
        userId: order.userId,
        mobile: (_c = user === null || user === void 0 ? void 0 : user.mobile) !== null && _c !== void 0 ? _c : '',
        nickname: (_d = user === null || user === void 0 ? void 0 : user.nickname) !== null && _d !== void 0 ? _d : '',
        email: (_e = user === null || user === void 0 ? void 0 : user.aiAccountEmail) !== null && _e !== void 0 ? _e : '',
        password,
    };
}
async function listTasks(event) {
    var _a, _b;
    const status = normalizeStatus((_b = (_a = event.queryStringParameters) === null || _a === void 0 ? void 0 : _a.status) !== null && _b !== void 0 ? _b : event.status);
    const result = await (0, db_1.collection)('orders')
        .where({
        payStatus: 'paid',
    })
        .get();
    const orders = result.data
        .filter((order) => isOrderVisibleForStatus(order, status))
        .sort((left, right) => { var _a, _b; return ((_a = right.paidAt) !== null && _a !== void 0 ? _a : right.createdAt) - ((_b = left.paidAt) !== null && _b !== void 0 ? _b : left.createdAt); })
        .slice(0, 50);
    const tasks = await Promise.all(orders.map(buildTask));
    return ok({ tasks });
}
async function updateTask(orderNo, body, event) {
    var _a, _b, _c;
    const status = normalizeStatus(String((_b = (_a = body.status) !== null && _a !== void 0 ? _a : event.status) !== null && _b !== void 0 ? _b : ''));
    const note = sanitizeNote((_c = body.note) !== null && _c !== void 0 ? _c : event.note);
    const order = await (0, db_1.getOrderByNo)(orderNo);
    if (!order) {
        return fail(404, '订单不存在');
    }
    if (order.payStatus !== 'paid') {
        return fail(400, '订单未支付，不能处理开通');
    }
    const now = Date.now();
    if (status === 'fulfilled') {
        await (0, orders_1.fulfillPaidOrderMembership)(order, { fulfilledAt: now });
        if (note) {
            await (0, db_1.collection)('orders').doc(order._id).update({
                data: {
                    operatorNote: note,
                    updatedAt: now,
                },
            });
        }
        return ok({ success: true, orderNo: order.orderNo, status: 'fulfilled' });
    }
    if (status === 'failed') {
        await (0, db_1.collection)('orders').doc(order._id).update({
            data: {
                fulfillmentStatus: 'failed',
                operatorFailedAt: now,
                operatorNote: note,
                updatedAt: now,
            },
        });
        return ok({ success: true, orderNo: order.orderNo, status: 'failed' });
    }
    await (0, db_1.collection)('orders').doc(order._id).update({
        data: {
            fulfillmentStatus: 'opening',
            operatorProcessingAt: now,
            operatorNote: note,
            updatedAt: now,
        },
    });
    return ok({ success: true, orderNo: order.orderNo, status: 'processing' });
}
async function getVerificationCode(orderNo) {
    const order = await (0, db_1.getOrderByNo)(orderNo);
    if (!order) {
        return fail(404, '订单不存在');
    }
    const user = await (0, db_1.getUserById)(order.userId);
    if (!(user === null || user === void 0 ? void 0 : user.aiAccountEmail)) {
        return fail(404, '该订单用户暂未填写注册邮箱');
    }
    const codeRecord = await (0, db_1.getLatestUnusedEmailVerificationCode)(user.aiAccountEmail);
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
async function main(event) {
    var _a;
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
            return getVerificationCode(route.orderNo);
        }
        return updateTask(route.orderNo, parseBody(event), event);
    }
    catch (error) {
        const statusCode = (_a = error.statusCode) !== null && _a !== void 0 ? _a : 500;
        console.error(JSON.stringify({
            tag: 'operator.api.error',
            statusCode,
            message: error instanceof Error ? error.message : String(error),
        }));
        return fail(statusCode, error instanceof Error ? error.message : '运营接口异常');
    }
}
