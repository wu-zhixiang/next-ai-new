"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseImageDataUrl = parseImageDataUrl;
exports.sha256Hex = sha256Hex;
exports.signWorkerPayload = signWorkerPayload;
exports.verifyWorkerSignature = verifyWorkerSignature;
exports.parseMultipartFormData = parseMultipartFormData;
const node_crypto_1 = require("node:crypto");
function parseImageDataUrl(value) {
    const matched = String(value || '').match(/^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!matched) {
        return null;
    }
    const normalizedMime = matched[1] === 'image/jpg' ? 'image/jpeg' : matched[1];
    const mimeType = normalizedMime;
    const extension = mimeType === 'image/jpeg' ? 'jpg' : mimeType === 'image/png' ? 'png' : 'webp';
    try {
        const buffer = Buffer.from(matched[2], 'base64');
        return buffer.length > 0 ? { mimeType, extension, buffer } : null;
    }
    catch (_a) {
        return null;
    }
}
function sha256Hex(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value).digest('hex');
}
function signWorkerPayload(params) {
    const bodyHash = sha256Hex(params.rawBody);
    const payload = `${params.taskId}${params.timestamp}${params.nonce}${bodyHash}`;
    return (0, node_crypto_1.createHmac)('sha256', params.secret).update(payload).digest('hex');
}
function verifyWorkerSignature(params) {
    var _a, _b;
    const timestampMs = Number(params.timestamp);
    if (!Number.isFinite(timestampMs)) {
        return false;
    }
    const skewMs = Math.abs(((_a = params.now) !== null && _a !== void 0 ? _a : Date.now()) - timestampMs);
    if (skewMs > ((_b = params.maxSkewMs) !== null && _b !== void 0 ? _b : 5 * 60 * 1000)) {
        return false;
    }
    const payload = `${params.taskId}${params.timestamp}${params.nonce}${params.bodyHash}`;
    const expected = (0, node_crypto_1.createHmac)('sha256', params.secret).update(payload).digest('hex');
    return expected === params.signature;
}
function parseMultipartFormData(body, contentType) {
    var _a, _b, _c, _d, _e, _f, _g;
    const boundary = (_a = contentType.match(/boundary="?([^";]+)"?/i)) === null || _a === void 0 ? void 0 : _a[1];
    if (!boundary) {
        throw new Error('缺少 multipart boundary');
    }
    const delimiter = `--${boundary}`;
    const text = body.toString('binary');
    const fields = {};
    const files = {};
    for (const rawPart of text.split(delimiter)) {
        const part = rawPart.replace(/^\r\n/, '').replace(/\r\n$/, '');
        if (!part || part === '--') {
            continue;
        }
        const separatorIndex = part.indexOf('\r\n\r\n');
        if (separatorIndex < 0) {
            continue;
        }
        const rawHeaders = part.slice(0, separatorIndex);
        let content = part.slice(separatorIndex + 4);
        if (content.endsWith('\r\n')) {
            content = content.slice(0, -2);
        }
        const disposition = (_c = (_b = rawHeaders.match(/content-disposition:\s*form-data;([^\r\n]+)/i)) === null || _b === void 0 ? void 0 : _b[1]) !== null && _c !== void 0 ? _c : '';
        const name = (_d = disposition.match(/name="([^"]+)"/i)) === null || _d === void 0 ? void 0 : _d[1];
        if (!name) {
            continue;
        }
        const filename = (_e = disposition.match(/filename="([^"]*)"/i)) === null || _e === void 0 ? void 0 : _e[1];
        if (filename !== undefined) {
            const contentTypeHeader = ((_g = (_f = rawHeaders.match(/content-type:\s*([^\r\n]+)/i)) === null || _f === void 0 ? void 0 : _f[1]) === null || _g === void 0 ? void 0 : _g.trim()) || 'application/octet-stream';
            files[name] = {
                filename,
                contentType: contentTypeHeader,
                buffer: Buffer.from(content, 'binary'),
            };
        }
        else {
            fields[name] = Buffer.from(content, 'binary').toString('utf8');
        }
    }
    return { fields, files };
}
