"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyWorkerSignature = exports.signWorkerPayload = exports.sha256Hex = exports.parseMultipartFormData = exports.parseImageDataUrl = void 0;
exports.getImageWorkerConfig = getImageWorkerConfig;
exports.uploadAiToolSourceImage = uploadAiToolSourceImage;
exports.getAiToolSourceImageTempUrl = getAiToolSourceImageTempUrl;
exports.uploadAiToolResultImage = uploadAiToolResultImage;
exports.submitOldPhotoRestoreJob = submitOldPhotoRestoreJob;
const node_crypto_1 = require("node:crypto");
const node_http_1 = __importDefault(require("node:http"));
const node_https_1 = __importDefault(require("node:https"));
const node_url_1 = require("node:url");
const db_1 = require("./db");
const ai_image_worker_core_1 = require("./ai-image-worker-core");
Object.defineProperty(exports, "parseImageDataUrl", { enumerable: true, get: function () { return ai_image_worker_core_1.parseImageDataUrl; } });
Object.defineProperty(exports, "parseMultipartFormData", { enumerable: true, get: function () { return ai_image_worker_core_1.parseMultipartFormData; } });
Object.defineProperty(exports, "sha256Hex", { enumerable: true, get: function () { return ai_image_worker_core_1.sha256Hex; } });
Object.defineProperty(exports, "signWorkerPayload", { enumerable: true, get: function () { return ai_image_worker_core_1.signWorkerPayload; } });
Object.defineProperty(exports, "verifyWorkerSignature", { enumerable: true, get: function () { return ai_image_worker_core_1.verifyWorkerSignature; } });
function getImageWorkerConfig() {
    return {
        baseUrl: (process.env.AI_WORKER_BASE_URL || 'https://wechat.aionhub.net').replace(/\/+$/, ''),
        workerSecret: process.env.AI_WORKER_SHARED_SECRET || '',
        callbackUrl: process.env.AI_WORKER_CALLBACK_URL || '',
        callbackSecret: process.env.AI_WORKER_CALLBACK_SECRET || '',
    };
}
async function uploadAiToolSourceImage(params) {
    var _a;
    const parsed = (0, ai_image_worker_core_1.parseImageDataUrl)(params.imageDataUrl);
    if (!parsed) {
        throw new Error('请上传 jpg、png 或 webp 图片');
    }
    const random = (0, node_crypto_1.randomBytes)(6).toString('hex');
    const cloudPath = `ai-tools/source/${params.userId}/${params.runId}-${random}.${parsed.extension}`;
    const upload = await db_1.app.uploadFile({
        cloudPath,
        fileContent: parsed.buffer,
    });
    const tempUrl = await db_1.app.getTempFileURL({
        fileList: [{ fileID: upload.fileID, maxAge: 30 * 60 }],
    });
    const tempFileURL = (_a = tempUrl.fileList[0]) === null || _a === void 0 ? void 0 : _a.tempFileURL;
    if (!tempFileURL) {
        throw new Error('生成图片临时访问链接失败');
    }
    return {
        fileId: upload.fileID,
        tempFileURL,
    };
}
async function getAiToolSourceImageTempUrl(fileId) {
    var _a;
    const normalizedFileId = String(fileId || '').trim();
    if (!normalizedFileId) {
        throw new Error('请先上传需要修复的旧照片');
    }
    const tempUrl = await db_1.app.getTempFileURL({
        fileList: [{ fileID: normalizedFileId, maxAge: 30 * 60 }],
    });
    const tempFileURL = (_a = tempUrl.fileList[0]) === null || _a === void 0 ? void 0 : _a.tempFileURL;
    if (!tempFileURL) {
        throw new Error('生成图片临时访问链接失败');
    }
    return {
        fileId: normalizedFileId,
        tempFileURL,
    };
}
async function uploadAiToolResultImage(params) {
    const extension = getImageExtensionFromName(params.filename);
    const random = (0, node_crypto_1.randomBytes)(6).toString('hex');
    const upload = await db_1.app.uploadFile({
        cloudPath: `ai-tools/results/${params.runId}-${random}.${extension}`,
        fileContent: params.buffer,
    });
    return { fileId: upload.fileID };
}
function getImageExtensionFromName(filename) {
    var _a;
    const extension = (_a = filename.toLowerCase().match(/\.([a-z0-9]+)$/)) === null || _a === void 0 ? void 0 : _a[1];
    if (extension === 'png')
        return 'png';
    if (extension === 'webp')
        return 'webp';
    return 'jpg';
}
async function submitOldPhotoRestoreJob(params) {
    var _a;
    const config = (_a = params.config) !== null && _a !== void 0 ? _a : getImageWorkerConfig();
    if (!config.workerSecret || config.workerSecret === 'change_me') {
        throw new Error('AI_WORKER_SHARED_SECRET 未配置');
    }
    if (!config.callbackUrl) {
        throw new Error('AI_WORKER_CALLBACK_URL 未配置');
    }
    const body = {
        taskId: params.runId,
        type: 'workflow.old_photo_restore',
        callbackUrl: config.callbackUrl,
        input: {
            imageUrl: params.inputImageUrl,
        },
        options: {
            model: params.model,
            outputFormat: 'jpg',
            quality: 'high',
        },
    };
    const rawBody = JSON.stringify(body);
    const timestamp = String(Date.now());
    const nonce = (0, node_crypto_1.randomBytes)(16).toString('hex');
    const signature = (0, ai_image_worker_core_1.signWorkerPayload)({
        secret: config.workerSecret,
        taskId: params.runId,
        timestamp,
        nonce,
        rawBody,
    });
    return postJson(`${config.baseUrl}/v1/jobs`, rawBody, {
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(rawBody)),
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature,
    });
}
async function postJson(url, body, headers) {
    const target = new node_url_1.URL(url);
    const client = target.protocol === 'http:' ? node_http_1.default : node_https_1.default;
    return new Promise((resolve, reject) => {
        const request = client.request({
            protocol: target.protocol,
            hostname: target.hostname,
            port: target.port,
            path: `${target.pathname}${target.search}`,
            method: 'POST',
            headers,
            timeout: 30000,
        }, (response) => {
            const chunks = [];
            response.on('data', (chunk) => chunks.push(chunk));
            response.on('end', () => {
                var _a, _b;
                const text = Buffer.concat(chunks).toString('utf8');
                if (((_a = response.statusCode) !== null && _a !== void 0 ? _a : 0) < 200 || ((_b = response.statusCode) !== null && _b !== void 0 ? _b : 0) >= 300) {
                    reject(new Error(`AI worker 请求失败：${response.statusCode} ${text.slice(0, 200)}`));
                    return;
                }
                try {
                    resolve(JSON.parse(text));
                }
                catch (_c) {
                    reject(new Error('AI worker 返回格式异常'));
                }
            });
        });
        request.on('error', reject);
        request.on('timeout', () => {
            request.destroy(new Error('AI worker 请求超时'));
        });
        request.write(body);
        request.end();
    });
}
