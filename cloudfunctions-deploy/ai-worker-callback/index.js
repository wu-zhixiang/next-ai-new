"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const constants_1 = require("./shared/constants");
const ai_image_worker_1 = require("./shared/ai-image-worker");
const ai_tool_service_1 = require("./shared/ai-tool-service");
function ok(data) {
    return { code: constants_1.SUCCESS_CODE, message: 'ok', data };
}
function fail(message) {
    return { code: 400, message, data: null };
}
function getHeader(headers, name) {
    const matched = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
    return (matched === null || matched === void 0 ? void 0 : matched[1]) || '';
}
function getBodyBuffer(event) {
    const body = event.body || '';
    return Buffer.from(body, event.isBase64Encoded ? 'base64' : 'utf8');
}
function parseUrlEncodedFormData(bodyBuffer) {
    const params = new URLSearchParams(bodyBuffer.toString('utf8'));
    const fields = {};
    params.forEach((value, key) => {
        fields[key] = value;
    });
    return { fields, files: {} };
}
function parseCallbackBody(bodyBuffer, contentType) {
    if (contentType.toLowerCase().includes('multipart/form-data')) {
        return (0, ai_image_worker_1.parseMultipartFormData)(bodyBuffer, contentType);
    }
    if (contentType.toLowerCase().includes('application/x-www-form-urlencoded')) {
        return parseUrlEncodedFormData(bodyBuffer);
    }
    throw new Error('不支持的回调 Content-Type');
}
function quotePythonString(value) {
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}
function pythonOptionalString(value) {
    return value && value !== 'None' ? quotePythonString(value) : 'None';
}
function buildWorkerCallbackDataRepr(fields) {
    const meta = fields.meta && fields.meta !== 'None' ? fields.meta : '{}';
    return [
        "{",
        `'taskId': ${quotePythonString(fields.taskId || '')}, `,
        `'status': ${quotePythonString(fields.status || '')}, `,
        `'errorCode': ${pythonOptionalString(fields.errorCode)}, `,
        `'message': ${pythonOptionalString(fields.message)}, `,
        `'meta': ${meta}`,
        "}",
    ].join('');
}
async function main(event = {}) {
    const headers = event.headers || {};
    const contentType = getHeader(headers, 'content-type');
    const timestamp = getHeader(headers, 'x-timestamp');
    const nonce = getHeader(headers, 'x-nonce');
    const signature = getHeader(headers, 'x-signature');
    const bodyBuffer = getBodyBuffer(event);
    const parsed = parseCallbackBody(bodyBuffer, contentType);
    const taskId = parsed.fields.taskId || '';
    if (!taskId) {
        return fail('缺少 taskId');
    }
    const config = (0, ai_image_worker_1.getImageWorkerConfig)();
    if (!config.callbackSecret || config.callbackSecret === 'change_me') {
        return fail('AI_WORKER_CALLBACK_SECRET 未配置');
    }
    const callbackDataRepr = buildWorkerCallbackDataRepr(parsed.fields);
    const verified = (0, ai_image_worker_1.verifyWorkerSignature)({
        secret: config.callbackSecret,
        taskId,
        timestamp,
        nonce,
        signature,
        bodyHash: (0, ai_image_worker_1.sha256Hex)(callbackDataRepr),
    });
    if (!verified) {
        return fail('回调签名校验失败');
    }
    if (parsed.fields.status !== 'success') {
        await (0, ai_tool_service_1.markAiToolImageRunFailed)({
            runId: taskId,
            errorCode: parsed.fields.errorCode || 'MODEL_FAILED',
            message: parsed.fields.message || '图片处理失败',
        });
        return ok({ received: true, taskId });
    }
    const resultFile = parsed.files.resultFile;
    if (!(resultFile === null || resultFile === void 0 ? void 0 : resultFile.buffer.length)) {
        await (0, ai_tool_service_1.markAiToolImageRunFailed)({
            runId: taskId,
            errorCode: 'EMPTY_RESULT',
            message: 'worker 未返回结果图片',
        });
        return ok({ received: true, taskId });
    }
    const upload = await (0, ai_image_worker_1.uploadAiToolResultImage)({
        runId: taskId,
        filename: resultFile.filename || 'result.jpg',
        buffer: resultFile.buffer,
    });
    await (0, ai_tool_service_1.markAiToolImageRunSucceeded)({
        runId: taskId,
        fileId: upload.fileId,
        message: parsed.fields.message || undefined,
    });
    return ok({ received: true, taskId });
}
