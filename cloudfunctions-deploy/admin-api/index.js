"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const ai_tool_config_1 = require("./shared/ai-tool-config");
const points_config_1 = require("./shared/points-config");
const payment_config_1 = require("./shared/payment-config");
const DEFAULT_ALLOWED_ORIGINS = [
    'http://localhost:5174',
    'http://127.0.0.1:5174',
];
const ADMIN_VISIBLE_DEFAULT_TOOL_ID_SET = new Set(ai_tool_config_1.ADMIN_VISIBLE_DEFAULT_TOOL_IDS);
const MAX_TOOL_IMAGE_BYTES = 3 * 1024 * 1024;
const MAX_ADMIN_UPLOAD_FILE_BYTES = 10 * 1024 * 1024;
const MAX_ADMIN_UPLOAD_CHUNK_COUNT = 240;
const ADMIN_UPLOAD_TEMP_URL_MAX_AGE = 365 * 24 * 60 * 60;
function getAllowedOrigins() {
    const configured = process.env.ADMIN_ALLOWED_ORIGINS;
    if (!configured) {
        return DEFAULT_ALLOWED_ORIGINS;
    }
    return configured.split(',').map((origin) => origin.trim()).filter(Boolean);
}
function buildCorsHeaders(event) {
    var _a;
    const origin = getHeader(event, 'origin');
    const allowedOrigins = getAllowedOrigins();
    const allowedOrigin = origin && allowedOrigins.includes(origin) ? origin : (_a = allowedOrigins[0]) !== null && _a !== void 0 ? _a : '';
    return {
        ...(allowedOrigin ? { 'access-control-allow-origin': allowedOrigin } : {}),
        'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'access-control-allow-headers': 'content-type,authorization',
        'content-type': 'application/json; charset=utf-8',
        'x-content-type-options': 'nosniff',
    };
}
function jsonResponse(event, statusCode, payload) {
    return {
        statusCode,
        headers: buildCorsHeaders(event),
        body: JSON.stringify(payload),
    };
}
function ok(event, data) {
    return jsonResponse(event, 200, { code: 0, message: 'ok', data });
}
function fail(event, statusCode, message) {
    return jsonResponse(event, statusCode, { code: statusCode, message, data: null });
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
    const rawPath = (_b = (_a = event.rawPath) !== null && _a !== void 0 ? _a : event.path) !== null && _b !== void 0 ? _b : '';
    return rawPath.replace(/\/$/, '');
}
function parseBody(event) {
    if (!event.body) {
        return {};
    }
    const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
    try {
        const parsed = JSON.parse(rawBody);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    }
    catch (_a) {
        return {};
    }
}
function assertAdminToken(event) {
    const expected = process.env.ADMIN_API_TOKEN || process.env.OPERATOR_API_TOKEN;
    if (!expected || expected.length < 16) {
        throw withStatus(new Error('缺少后台接口密钥配置：ADMIN_API_TOKEN'), 500);
    }
    const authorization = getHeader(event, 'authorization');
    const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : '';
    if (token !== expected) {
        throw withStatus(new Error('后台密钥不正确'), 401);
    }
}
function withStatus(error, statusCode) {
    return Object.assign(error, { statusCode });
}
function adminCollection(name) {
    return (0, db_1.collection)(name);
}
async function readCollection(name) {
    const result = await adminCollection(name).get();
    return result.data;
}
function toIsoTime(value) {
    const timestamp = Number.isFinite(value) && value ? value : Date.now();
    return new Date(timestamp).toISOString();
}
function sanitizeText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}
function sanitizeNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}
function sanitizePrice(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Number(numeric.toFixed(2))) : 0;
}
function sanitizeBoolean(value, fallback = false) {
    if (typeof value === 'boolean') {
        return value;
    }
    if (value === 'true' || value === '1' || value === 1) {
        return true;
    }
    if (value === 'false' || value === '0' || value === 0) {
        return false;
    }
    return fallback;
}
function normalizeFulfillmentMode(value, fallback = 'immediate') {
    return value === 'manual' || value === 'immediate' ? value : fallback;
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function normalizeConfigStatus(value) {
    return value === 'on' ? 'on' : 'off';
}
function normalizeSort(value, fallback = 999) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
}
function createConfigCode(value, prefix) {
    const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 40);
    return slug ? `${prefix}_${slug}` : `${prefix}_${Date.now()}`;
}
function generatePlanPid(productCode, planCode) {
    return `${productCode}_${planCode}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}
function normalizeIntroHighlights(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return value
        .map((item) => {
        if (!isRecord(item)) {
            return null;
        }
        const title = sanitizeText(item.title, 40);
        const description = sanitizeText(item.description, 160);
        return title || description ? { title, description } : null;
    })
        .filter((item) => Boolean(item))
        .slice(0, 8);
}
function normalizeProductComplianceDisplay(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    const productName = sanitizeText(value.productName, 60);
    const label = sanitizeText(value.label, 40);
    const tag = sanitizeText(value.tag, 40);
    const avatarUrl = sanitizeText(value.avatarUrl, 500);
    const detailPageUrl = sanitizeText(value.detailPageUrl, 200);
    const description = sanitizeText(value.description, 240);
    const introHighlights = normalizeIntroHighlights(value.introHighlights);
    if (!productName && !label && !tag && !avatarUrl && !detailPageUrl && !description && introHighlights.length === 0) {
        return undefined;
    }
    return {
        productName,
        label,
        tag,
        ...(avatarUrl ? { avatarUrl } : {}),
        ...(detailPageUrl ? { detailPageUrl } : {}),
        description,
        ...(introHighlights.length ? { introHighlights } : {}),
    };
}
function normalizePlanComplianceDisplay(value) {
    if (!isRecord(value)) {
        return undefined;
    }
    const productName = sanitizeText(value.productName, 60);
    const planName = sanitizeText(value.planName, 60);
    const description = sanitizeText(value.description, 240);
    if (!productName && !planName && !description) {
        return undefined;
    }
    return {
        productName,
        planName,
        ...(description ? { description } : {}),
    };
}
function requirePlanComplianceDisplay(value) {
    const display = normalizePlanComplianceDisplay(value);
    if (!(display === null || display === void 0 ? void 0 : display.productName) || !display.planName || !display.description) {
        throw withStatus(new Error('启用合规展示后，请填写合规商品名、合规套餐名和合规说明'), 422);
    }
    return display;
}
function maskMobile(value) {
    const mobile = value.trim();
    if (mobile.length < 7) {
        return mobile;
    }
    return `${mobile.slice(0, 3)}****${mobile.slice(-4)}`;
}
function matchRoute(path) {
    const normalized = path.replace(/^\/admin-api/, '');
    if (normalized === '/dashboard') {
        return {};
    }
    const matched = normalized.match(/^\/(users|orders|news|tools|product-types|plans|files)(?:\/([^/]+))?$/);
    if (!(matched === null || matched === void 0 ? void 0 : matched[1])) {
        return {};
    }
    return {
        resource: matched[1],
        id: matched[2] ? decodeURIComponent(matched[2]) : undefined,
    };
}
function getUserMembership(userId, memberships) {
    const userMemberships = memberships
        .filter((membership) => membership.userId === userId)
        .sort((left, right) => right.endAt - left.endAt);
    const active = userMemberships.find((membership) => membership.status === 'active');
    const fallback = userMemberships[0];
    const target = active !== null && active !== void 0 ? active : fallback;
    if (!target) {
        return '无会员';
    }
    return target.planName || target.productName || '会员';
}
function toUserView(user, memberships) {
    var _a, _b;
    return {
        id: user._id,
        nickname: user.nickname || '微信用户',
        mobileMasked: maskMobile(user.mobile || ''),
        membership: getUserMembership(user._id, memberships),
        points: Number((_a = user.pointsBalance) !== null && _a !== void 0 ? _a : 0),
        status: user.status,
        createdAt: toIsoTime(user.createdAt),
        lastActiveAt: toIsoTime((_b = user.lastLoginAt) !== null && _b !== void 0 ? _b : user.updatedAt),
    };
}
function orderStatusFromRecord(order) {
    if (order.payStatus === 'paid' && order.fulfillmentStatus === 'fulfilled') {
        return 'fulfilled';
    }
    if (order.payStatus === 'paid') {
        return 'paid';
    }
    if (order.payStatus === 'refunded') {
        return 'refunded';
    }
    if (order.payStatus === 'closed') {
        return 'closed';
    }
    return 'pending';
}
function getOrderUserName(order, userMap) {
    const user = userMap.get(order.userId);
    return (user === null || user === void 0 ? void 0 : user.nickname) || ((user === null || user === void 0 ? void 0 : user.mobile) ? maskMobile(user.mobile) : order.userId);
}
function toOrderView(order, userMap) {
    var _a, _b, _c;
    return {
        id: order._id,
        orderNo: order.orderNo,
        userName: getOrderUserName(order, userMap),
        productName: order.planName || order.productName,
        amountCents: Number((_a = order.amount) !== null && _a !== void 0 ? _a : 0),
        status: orderStatusFromRecord(order),
        paidAt: toIsoTime((_b = order.paidAt) !== null && _b !== void 0 ? _b : order.createdAt),
        fulfillmentStatus: (_c = order.fulfillmentStatus) !== null && _c !== void 0 ? _c : 'pending',
    };
}
function toNewsView(record) {
    var _a;
    return {
        id: record._id,
        title: record.title,
        sourceName: record.sourceName,
        status: record.status,
        viewCount: Number((_a = record.viewCount) !== null && _a !== void 0 ? _a : 0),
        publishAt: toIsoTime(record.publishedAt),
        summary: record.summary,
    };
}
function normalizeToolCategory(value) {
    return (0, ai_tool_config_1.normalizeToolConfigCategory)(value);
}
function normalizeToolStatus(value) {
    return (0, ai_tool_config_1.normalizeToolConfigStatus)(value);
}
function findToolRecord(records, id) {
    return records.find((record) => record._id === id || record.toolId === id);
}
function isBuiltInAdminTool(toolId) {
    return ADMIN_VISIBLE_DEFAULT_TOOL_ID_SET.has(toolId);
}
function mergeDefaultToolRecord(definition, override) {
    var _a, _b, _c, _d, _e;
    if (override === null || override === void 0 ? void 0 : override.deleted) {
        return undefined;
    }
    const base = (0, ai_tool_config_1.buildDefaultAiToolRecord)(definition);
    if (!override) {
        return base;
    }
    return {
        ...base,
        ...override,
        _id: override._id,
        toolId: definition.toolId,
        builtIn: true,
        runCount: Number((_a = override.runCount) !== null && _a !== void 0 ? _a : base.runCount),
        tags: (0, ai_tool_config_1.normalizeAiToolTags)(override.tags, (_b = base.tags) !== null && _b !== void 0 ? _b : []),
        sortOrder: (0, ai_tool_config_1.normalizeAiToolSortOrder)(override.sortOrder, (_c = base.sortOrder) !== null && _c !== void 0 ? _c : 999),
        createdAt: Number((_d = override.createdAt) !== null && _d !== void 0 ? _d : base.createdAt),
        updatedAt: Number((_e = override.updatedAt) !== null && _e !== void 0 ? _e : base.updatedAt),
    };
}
function mergeToolRecords(records) {
    var _a;
    const recordsByToolId = new Map();
    for (const record of records) {
        const key = (_a = record.toolId) !== null && _a !== void 0 ? _a : (isBuiltInAdminTool(record._id) ? record._id : '');
        if (key) {
            recordsByToolId.set(key, record);
        }
    }
    const builtInRecords = (0, ai_tool_config_1.getDefaultAdminToolDefinitions)()
        .map((definition) => mergeDefaultToolRecord(definition, recordsByToolId.get(definition.toolId)))
        .filter((record) => Boolean(record));
    const customRecords = records
        .filter((record) => !record.deleted)
        .filter((record) => { var _a; return !isBuiltInAdminTool((_a = record.toolId) !== null && _a !== void 0 ? _a : record._id); })
        .map((record) => {
        var _a;
        return ({
            ...record,
            toolId: (_a = record.toolId) !== null && _a !== void 0 ? _a : record._id,
            builtIn: Boolean(record.builtIn),
        });
    });
    return [...builtInRecords, ...customRecords];
}
async function getToolRunCounts() {
    var _a;
    try {
        await (0, db_1.ensureCollection)('aiToolRuns');
        const records = await readCollection('aiToolRuns');
        const counts = new Map();
        for (const record of records) {
            counts.set(record.toolId, ((_a = counts.get(record.toolId)) !== null && _a !== void 0 ? _a : 0) + 1);
        }
        return counts;
    }
    catch (_b) {
        return new Map();
    }
}
function getWritableToolRecord(record) {
    const { _id: _documentId, ...data } = record;
    return data;
}
function createCustomToolId(name) {
    const slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 32);
    return slug ? `custom_${slug}` : `custom_${Date.now()}`;
}
function getExtensionFromMimeType(mimeType) {
    var _a;
    const normalized = mimeType.toLowerCase();
    const map = {
        'application/json': 'json',
        'application/pdf': 'pdf',
        'application/vnd.ms-excel': 'xls',
        'application/vnd.ms-powerpoint': 'ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
        'image/gif': 'gif',
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/svg+xml': 'svg',
        'image/webp': 'webp',
        'text/csv': 'csv',
        'text/html': 'html',
        'text/markdown': 'md',
        'text/plain': 'txt',
    };
    return (_a = map[normalized]) !== null && _a !== void 0 ? _a : 'bin';
}
function getExtensionFromFileName(fileName) {
    var _a, _b, _c;
    const extension = (_c = (_b = (_a = fileName.split('?')[0]) === null || _a === void 0 ? void 0 : _a.split('#')[0]) === null || _b === void 0 ? void 0 : _b.match(/\.([a-z0-9]{1,16})$/i)) === null || _c === void 0 ? void 0 : _c[1];
    return extension ? extension.toLowerCase() : '';
}
function sanitizeUploadFileName(value, fallbackExtension) {
    const rawName = sanitizeText(value, 160);
    const fallbackName = `upload.${fallbackExtension || 'bin'}`;
    return rawName || fallbackName;
}
function sanitizeCloudPathSegment(value) {
    const normalized = value
        .replace(/\.[a-z0-9]{1,16}$/i, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80);
    return normalized || 'file';
}
function parseAdminUploadDataUrl(body) {
    const dataUrl = body.dataUrl;
    if (typeof dataUrl !== 'string') {
        throw withStatus(new Error('缺少上传文件'), 422);
    }
    const matched = dataUrl.match(/^data:([^;,]*);base64,([A-Za-z0-9+/=]+)$/);
    if (!matched || !matched[2]) {
        throw withStatus(new Error('上传文件格式不正确'), 422);
    }
    const mimeType = (matched[1] || 'application/octet-stream').toLowerCase();
    const extensionFromMime = getExtensionFromMimeType(mimeType);
    const name = sanitizeUploadFileName(body.fileName, extensionFromMime);
    const extension = getExtensionFromFileName(name) || extensionFromMime;
    const bytes = Buffer.from(matched[2], 'base64');
    if (bytes.length === 0) {
        throw withStatus(new Error('上传文件为空'), 422);
    }
    if (bytes.length > MAX_ADMIN_UPLOAD_FILE_BYTES) {
        throw withStatus(new Error('文件不能超过 10MB'), 422);
    }
    return {
        name,
        extension,
        mimeType,
        bytes,
    };
}
function parseToolImageDataUrl(value) {
    if (typeof value !== 'string') {
        throw withStatus(new Error('缺少图片文件'), 422);
    }
    const matched = value.match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/);
    if (!(matched === null || matched === void 0 ? void 0 : matched[1]) || !matched[2]) {
        throw withStatus(new Error('图片仅支持 PNG/JPG/WebP'), 422);
    }
    const extension = matched[1].startsWith('jp') ? 'jpg' : matched[1];
    const bytes = Buffer.from(matched[2], 'base64');
    if (bytes.length === 0) {
        throw withStatus(new Error('图片文件为空'), 422);
    }
    if (bytes.length > MAX_TOOL_IMAGE_BYTES) {
        throw withStatus(new Error('图片不能超过 3MB'), 422);
    }
    return { extension, bytes };
}
function sanitizeUploadId(value) {
    const uploadId = sanitizeText(value, 80);
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(uploadId)) {
        throw withStatus(new Error('上传会话无效'), 422);
    }
    return uploadId;
}
function parseUploadChunkBody(body, scope) {
    const uploadId = sanitizeUploadId(body.uploadId);
    const chunkIndex = Math.floor(Number(body.chunkIndex));
    const chunkCount = Math.floor(Number(body.chunkCount));
    const totalSize = Math.floor(Number(body.totalSize));
    const mimeType = sanitizeText(body.mimeType, 120).toLowerCase() || 'application/octet-stream';
    const fallbackExtension = getExtensionFromMimeType(mimeType);
    const fileName = sanitizeUploadFileName(body.fileName, fallbackExtension);
    const chunkData = typeof body.chunkData === 'string' ? body.chunkData.trim() : '';
    if (!Number.isFinite(chunkIndex) || chunkIndex < 0) {
        throw withStatus(new Error('上传分片序号无效'), 422);
    }
    if (!Number.isFinite(chunkCount) || chunkCount < 1 || chunkCount > MAX_ADMIN_UPLOAD_CHUNK_COUNT || chunkIndex >= chunkCount) {
        throw withStatus(new Error('上传分片数量无效'), 422);
    }
    if (!Number.isFinite(totalSize) || totalSize <= 0 || totalSize > MAX_ADMIN_UPLOAD_FILE_BYTES) {
        throw withStatus(new Error('文件不能超过 10MB'), 422);
    }
    if (scope === 'toolAsset') {
        if (!/^image\/(?:png|jpe?g|webp)$/.test(mimeType)) {
            throw withStatus(new Error('图片仅支持 PNG/JPG/WebP'), 422);
        }
        if (totalSize > MAX_TOOL_IMAGE_BYTES) {
            throw withStatus(new Error('图片不能超过 3MB'), 422);
        }
    }
    if (!/^[A-Za-z0-9+/=]+$/.test(chunkData)) {
        throw withStatus(new Error('上传分片格式不正确'), 422);
    }
    const chunkBytes = Buffer.from(chunkData, 'base64');
    if (chunkBytes.length === 0 || chunkBytes.length > 512 * 1024) {
        throw withStatus(new Error('上传分片大小无效'), 422);
    }
    return {
        uploadId,
        scope,
        chunkIndex,
        chunkCount,
        fileName,
        mimeType,
        totalSize,
        chunkData,
        createdAt: Date.now(),
    };
}
async function saveUploadChunk(record) {
    await (0, db_1.ensureCollection)('adminUploadChunks');
    const existing = await adminCollection('adminUploadChunks')
        .where({
        uploadId: record.uploadId,
        scope: record.scope,
        chunkIndex: record.chunkIndex,
    })
        .limit(1)
        .get();
    const current = existing.data[0];
    if (current === null || current === void 0 ? void 0 : current._id) {
        await adminCollection('adminUploadChunks').doc(current._id).update({ data: record });
        return;
    }
    await adminCollection('adminUploadChunks').add({ data: record });
}
async function readUploadChunks(uploadId, scope) {
    await (0, db_1.ensureCollection)('adminUploadChunks');
    const result = await adminCollection('adminUploadChunks').where({ uploadId, scope }).get();
    return result.data
        .filter((record) => Boolean(record._id))
        .sort((left, right) => left.chunkIndex - right.chunkIndex);
}
async function deleteUploadChunks(records) {
    await Promise.all(records.map((record) => adminCollection('adminUploadChunks').doc(record._id).remove()));
}
function assembleUploadChunks(records, expected) {
    if (records.length !== expected.chunkCount) {
        throw withStatus(new Error('上传分片未完成'), 202);
    }
    const seen = new Set();
    for (const record of records) {
        if (record.chunkCount !== expected.chunkCount || record.totalSize !== expected.totalSize || record.mimeType !== expected.mimeType) {
            throw withStatus(new Error('上传分片信息不一致'), 422);
        }
        seen.add(record.chunkIndex);
    }
    for (let index = 0; index < expected.chunkCount; index += 1) {
        if (!seen.has(index)) {
            throw withStatus(new Error('上传分片未完成'), 202);
        }
    }
    const bytes = Buffer.concat(records.map((record) => Buffer.from(record.chunkData, 'base64')));
    if (bytes.length !== expected.totalSize) {
        throw withStatus(new Error('上传文件大小不一致'), 422);
    }
    return bytes;
}
function toPublicFileUrl(tempUrl) {
    var _a;
    return (_a = tempUrl.split('?')[0]) !== null && _a !== void 0 ? _a : '';
}
function normalizeAdminFileUsage(value) {
    if (value === 'icon' || value === 'image' || value === 'document' || value === 'other') {
        return value;
    }
    return 'icon';
}
function normalizeAdminFileDisplayName(value, fallback) {
    return sanitizeText(value, 120) || fallback;
}
function normalizeAdminFileNote(value) {
    return sanitizeText(value, 240);
}
async function getFileUrls(fileId) {
    var _a, _b;
    try {
        const result = await db_1.app.getTempFileURL({
            fileList: [{ fileID: fileId, maxAge: ADMIN_UPLOAD_TEMP_URL_MAX_AGE }],
        });
        const tempUrl = (_b = (_a = result.fileList[0]) === null || _a === void 0 ? void 0 : _a.tempFileURL) !== null && _b !== void 0 ? _b : '';
        return {
            tempUrl,
            publicUrl: toPublicFileUrl(tempUrl),
        };
    }
    catch (_c) {
        return { tempUrl: '', publicUrl: '' };
    }
}
async function getFileUrlsMap(fileIds) {
    var _a, _b;
    const uniqueFileIds = Array.from(new Set(fileIds.filter(Boolean)));
    if (uniqueFileIds.length === 0) {
        return new Map();
    }
    try {
        const result = await db_1.app.getTempFileURL({
            fileList: uniqueFileIds.map((fileID) => ({ fileID, maxAge: ADMIN_UPLOAD_TEMP_URL_MAX_AGE })),
        });
        const urls = new Map();
        for (const item of result.fileList) {
            const fileId = (_a = item.fileID) !== null && _a !== void 0 ? _a : '';
            const tempUrl = (_b = item.tempFileURL) !== null && _b !== void 0 ? _b : '';
            if (fileId) {
                urls.set(fileId, {
                    tempUrl,
                    publicUrl: toPublicFileUrl(tempUrl),
                });
            }
        }
        return urls;
    }
    catch (_c) {
        return new Map();
    }
}
function toAdminFileView(record, urls) {
    var _a, _b;
    return {
        id: record._id,
        fileId: record.fileId,
        url: urls.tempUrl,
        tempUrl: urls.tempUrl,
        publicUrl: urls.publicUrl,
        cloudPath: record.cloudPath,
        name: record.name,
        displayName: record.displayName || record.name,
        usage: normalizeAdminFileUsage(record.usage),
        note: (_a = record.note) !== null && _a !== void 0 ? _a : '',
        size: Number((_b = record.size) !== null && _b !== void 0 ? _b : 0),
        mimeType: record.mimeType || 'application/octet-stream',
        createdAt: toIsoTime(record.createdAt),
        updatedAt: toIsoTime(record.updatedAt),
    };
}
async function listAdminFiles(event) {
    await (0, db_1.ensureCollection)('adminFiles');
    const records = await readCollection('adminFiles');
    const sortedRecords = records
        .sort((left, right) => { var _a, _b, _c, _d; return ((_b = (_a = right.updatedAt) !== null && _a !== void 0 ? _a : right.createdAt) !== null && _b !== void 0 ? _b : 0) - ((_d = (_c = left.updatedAt) !== null && _c !== void 0 ? _c : left.createdAt) !== null && _d !== void 0 ? _d : 0); })
        .slice(0, 500);
    const urls = await getFileUrlsMap(sortedRecords.map((record) => record.fileId));
    const data = sortedRecords.map((record) => { var _a; return toAdminFileView(record, (_a = urls.get(record.fileId)) !== null && _a !== void 0 ? _a : { tempUrl: '', publicUrl: '' }); });
    return ok(event, data);
}
async function uploadAdminFile(event) {
    await (0, db_1.ensureCollection)('adminFiles');
    const body = parseBody(event);
    const file = parseAdminUploadDataUrl(body);
    const now = Date.now();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const baseName = sanitizeCloudPathSegment(file.name);
    const cloudPath = `cloud-admin/uploads/${now}-${random}-${baseName}.${file.extension}`;
    const result = await db_1.app.uploadFile({
        cloudPath,
        fileContent: file.bytes,
    });
    const record = {
        fileId: result.fileID,
        cloudPath,
        name: file.name,
        displayName: normalizeAdminFileDisplayName(body.displayName, file.name),
        usage: normalizeAdminFileUsage(body.usage),
        note: normalizeAdminFileNote(body.note),
        size: file.bytes.length,
        mimeType: file.mimeType,
        createdAt: now,
        updatedAt: now,
    };
    const created = await adminCollection('adminFiles').add({ data: record });
    const fileUrls = await getFileUrls(result.fileID);
    return ok(event, toAdminFileView({ ...record, _id: created._id }, fileUrls));
}
async function uploadAdminFileChunk(event) {
    await (0, db_1.ensureCollection)('adminFiles');
    const body = parseBody(event);
    const chunk = parseUploadChunkBody(body, 'file');
    await saveUploadChunk(chunk);
    const chunks = await readUploadChunks(chunk.uploadId, 'file');
    if (chunks.length < chunk.chunkCount) {
        return ok(event, {
            uploadId: chunk.uploadId,
            received: chunks.length,
            chunkCount: chunk.chunkCount,
            done: false,
        });
    }
    const bytes = assembleUploadChunks(chunks, chunk);
    const now = Date.now();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const extension = getExtensionFromFileName(chunk.fileName) || getExtensionFromMimeType(chunk.mimeType);
    const baseName = sanitizeCloudPathSegment(chunk.fileName);
    const cloudPath = `cloud-admin/uploads/${now}-${random}-${baseName}.${extension}`;
    const result = await db_1.app.uploadFile({
        cloudPath,
        fileContent: bytes,
    });
    const record = {
        fileId: result.fileID,
        cloudPath,
        name: chunk.fileName,
        displayName: normalizeAdminFileDisplayName(body.displayName, chunk.fileName),
        usage: normalizeAdminFileUsage(body.usage),
        note: normalizeAdminFileNote(body.note),
        size: bytes.length,
        mimeType: chunk.mimeType,
        createdAt: now,
        updatedAt: now,
    };
    const created = await adminCollection('adminFiles').add({ data: record });
    await deleteUploadChunks(chunks);
    const fileUrls = await getFileUrls(result.fileID);
    return ok(event, {
        ...toAdminFileView({ ...record, _id: created._id }, fileUrls),
        uploadId: chunk.uploadId,
        received: chunks.length,
        chunkCount: chunk.chunkCount,
        done: true,
    });
}
async function updateAdminFile(event, fileRecordId) {
    var _a;
    await (0, db_1.ensureCollection)('adminFiles');
    const existing = await adminCollection('adminFiles').doc(fileRecordId).get()
        .then((result) => result.data)
        .catch(() => undefined);
    if (!existing) {
        return fail(event, 404, '文件记录不存在');
    }
    const body = parseBody(event);
    const updatedAt = Date.now();
    const patch = {
        displayName: normalizeAdminFileDisplayName(body.displayName, existing.displayName || existing.name),
        usage: normalizeAdminFileUsage((_a = body.usage) !== null && _a !== void 0 ? _a : existing.usage),
        note: normalizeAdminFileNote(body.note),
        updatedAt,
    };
    await adminCollection('adminFiles').doc(fileRecordId).update({ data: patch });
    const fileUrls = await getFileUrls(existing.fileId);
    return ok(event, toAdminFileView({ ...existing, ...patch, _id: fileRecordId }, fileUrls));
}
function isMissingCloudFileMessage(value) {
    const normalized = value.toLowerCase();
    return normalized.includes('not exist') || normalized.includes('not found') || normalized.includes('不存在');
}
async function deleteCloudFile(fileId) {
    var _a, _b;
    if (!fileId) {
        return;
    }
    try {
        const result = await db_1.app.deleteFile({ fileList: [fileId] });
        const target = result.fileList[0];
        const status = (_a = target === null || target === void 0 ? void 0 : target.status) !== null && _a !== void 0 ? _a : 0;
        const errMsg = (_b = target === null || target === void 0 ? void 0 : target.errMsg) !== null && _b !== void 0 ? _b : '';
        if (status !== 0 && !isMissingCloudFileMessage(errMsg)) {
            throw new Error(errMsg || 'deleteFile failed');
        }
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isMissingCloudFileMessage(message)) {
            return;
        }
        throw withStatus(new Error('删除云存储文件失败'), 500);
    }
}
async function deleteAdminFile(event, fileRecordId) {
    const body = parseBody(event);
    if (body.confirm !== 'DELETE') {
        return fail(event, 400, '删除操作缺少二次确认');
    }
    await (0, db_1.ensureCollection)('adminFiles');
    const existing = await adminCollection('adminFiles').doc(fileRecordId).get()
        .then((result) => result.data)
        .catch(() => undefined);
    if (!existing) {
        return fail(event, 404, '文件记录不存在');
    }
    await deleteCloudFile(existing.fileId);
    await adminCollection('adminFiles').doc(fileRecordId).remove();
    return ok(event, { deleted: true });
}
async function uploadToolAsset(event) {
    const body = parseBody(event);
    const file = parseToolImageDataUrl(body.dataUrl);
    const now = Date.now();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const result = await db_1.app.uploadFile({
        cloudPath: `ai-tools/intro/${now}-${random}.${file.extension}`,
        fileContent: file.bytes,
    });
    return ok(event, { fileId: result.fileID });
}
async function uploadToolAssetChunk(event) {
    const body = parseBody(event);
    const chunk = parseUploadChunkBody(body, 'toolAsset');
    await saveUploadChunk(chunk);
    const chunks = await readUploadChunks(chunk.uploadId, 'toolAsset');
    if (chunks.length < chunk.chunkCount) {
        return ok(event, {
            uploadId: chunk.uploadId,
            received: chunks.length,
            chunkCount: chunk.chunkCount,
            done: false,
        });
    }
    const bytes = assembleUploadChunks(chunks, chunk);
    const extension = getExtensionFromFileName(chunk.fileName) || getExtensionFromMimeType(chunk.mimeType);
    const now = Date.now();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
    const result = await db_1.app.uploadFile({
        cloudPath: `ai-tools/intro/${now}-${random}.${extension}`,
        fileContent: bytes,
    });
    await deleteUploadChunks(chunks);
    return ok(event, {
        fileId: result.fileID,
        uploadId: chunk.uploadId,
        received: chunks.length,
        chunkCount: chunk.chunkCount,
        done: true,
    });
}
function normalizeToolOutputType(value, existing) {
    if (value === 'bullets' || value === 'xiaohongshu' || value === 'moments') {
        return value;
    }
    return existing !== null && existing !== void 0 ? existing : 'summary';
}
function toToolView(record, runCounts) {
    var _a, _b, _c, _d, _e, _f;
    const toolId = (_a = record.toolId) !== null && _a !== void 0 ? _a : record._id;
    const intro = (0, ai_tool_config_1.normalizeAiToolIntroConfig)(record.intro);
    return {
        id: record._id,
        toolId,
        name: record.name,
        category: normalizeToolCategory(record.category),
        status: normalizeToolStatus(record.status),
        runCount: (_b = runCounts.get(toolId)) !== null && _b !== void 0 ? _b : Number((_c = record.runCount) !== null && _c !== void 0 ? _c : 0),
        pointCost: Number((_d = record.pointCost) !== null && _d !== void 0 ? _d : 0),
        trialLimit: Number((_e = record.trialLimit) !== null && _e !== void 0 ? _e : 0),
        updatedAt: toIsoTime(record.updatedAt),
        builtIn: Boolean(record.builtIn),
        cardTitle: record.cardTitle || record.name,
        cardDescription: record.cardDescription || '',
        cardBadge: (0, ai_tool_config_1.normalizeAiToolTags)(record.tags, [record.cardBadge || ''].filter(Boolean))[0] || (normalizeToolStatus(record.status) === 'enabled' ? '已上线' : '接入中'),
        tags: (0, ai_tool_config_1.normalizeAiToolTags)(record.tags, [record.cardBadge || ''].filter(Boolean)),
        icon: record.icon || 'AI',
        iconImageFileId: record.iconImageFileId || '',
        visible: record.visible !== false,
        sortOrder: (0, ai_tool_config_1.normalizeAiToolSortOrder)(record.sortOrder, 999),
        outputType: (_f = record.outputType) !== null && _f !== void 0 ? _f : 'summary',
        workerModel: (0, ai_tool_config_1.normalizeAiToolWorkerModel)(record.workerModel),
        ...(intro ? { intro } : {}),
    };
}
function toProductTypeView(record) {
    var _a, _b, _c, _d;
    const complianceEnabled = (_a = record.complianceEnabled) !== null && _a !== void 0 ? _a : Boolean(record.complianceDisplay);
    return {
        id: record._id,
        productCode: record.productCode,
        productName: record.productName,
        label: record.label,
        tag: record.tag,
        avatarUrl: (_b = record.avatarUrl) !== null && _b !== void 0 ? _b : '',
        detailPageUrl: (_c = record.detailPageUrl) !== null && _c !== void 0 ? _c : '',
        available: Boolean(record.available),
        description: record.description,
        introHighlights: (_d = record.introHighlights) !== null && _d !== void 0 ? _d : [],
        complianceEnabled,
        ...(complianceEnabled && record.complianceDisplay ? { complianceDisplay: record.complianceDisplay } : {}),
        fulfillmentMode: normalizeFulfillmentMode(record.fulfillmentMode),
        sort: normalizeSort(record.sort, 999),
        status: normalizeConfigStatus(record.status),
        createdAt: toIsoTime(record.createdAt),
        updatedAt: toIsoTime(record.updatedAt),
    };
}
function toMemberPlanView(record) {
    var _a, _b, _c, _d, _e, _f, _g;
    return {
        id: record._id,
        pid: (_a = record.pid) !== null && _a !== void 0 ? _a : generatePlanPid(record.productCode, record.planCode),
        productCode: record.productCode,
        productName: record.productName,
        planCode: record.planCode,
        planName: record.planName,
        virtualPaymentProductId: (_b = record.virtualPaymentProductId) !== null && _b !== void 0 ? _b : '',
        price: Number((_c = record.price) !== null && _c !== void 0 ? _c : 0),
        totalAiPoints: Number((_d = record.totalAiPoints) !== null && _d !== void 0 ? _d : 0),
        durationDays: Number((_e = record.durationDays) !== null && _e !== void 0 ? _e : 0),
        autoRenewEnabled: Boolean(record.autoRenewEnabled),
        complianceEnabled: (_f = record.complianceEnabled) !== null && _f !== void 0 ? _f : Boolean(record.complianceDisplay),
        status: normalizeConfigStatus(record.status),
        sort: normalizeSort(record.sort, 999),
        description: (_g = record.description) !== null && _g !== void 0 ? _g : '',
        ...(record.complianceDisplay ? { complianceDisplay: record.complianceDisplay } : {}),
        createdAt: toIsoTime(record.createdAt),
        updatedAt: toIsoTime(record.updatedAt),
    };
}
function toPointsConfigView(record) {
    return {
        pointsPerYuan: record.pointsPerYuan,
        inviteBaseRewardPoints: record.inviteBaseRewardPoints,
        inviteMilestones: record.inviteMilestones,
        updatedAt: toIsoTime(record.updatedAt),
    };
}
function findProductTypeRecord(records, id) {
    return records.find((record) => record._id === id || record.productCode === id);
}
function findMemberPlanRecord(records, id) {
    return records.find((record) => record._id === id || record.pid === id);
}
function normalizeProductTypeInput(body, existing, fallbackProductCode) {
    var _a, _b, _c, _d, _e, _f, _g;
    const now = Date.now();
    const productName = sanitizeText(body.productName, 60) || (existing === null || existing === void 0 ? void 0 : existing.productName) || '';
    if (!productName) {
        throw withStatus(new Error('商品名称不能为空'), 422);
    }
    const requestedCode = sanitizeText(body.productCode, 60);
    const productCode = ((_b = (_a = existing === null || existing === void 0 ? void 0 : existing.productCode) !== null && _a !== void 0 ? _a : fallbackProductCode) !== null && _b !== void 0 ? _b : requestedCode) || createConfigCode(productName, 'product');
    const complianceEnabled = sanitizeBoolean(body.complianceEnabled, (_c = existing === null || existing === void 0 ? void 0 : existing.complianceEnabled) !== null && _c !== void 0 ? _c : Boolean(existing === null || existing === void 0 ? void 0 : existing.complianceDisplay));
    return {
        productCode,
        productName,
        label: sanitizeText(body.label, 40) || productName,
        tag: sanitizeText(body.tag, 40),
        avatarUrl: sanitizeText(body.avatarUrl, 500),
        detailPageUrl: sanitizeText(body.detailPageUrl, 200),
        available: sanitizeBoolean(body.available, (_d = existing === null || existing === void 0 ? void 0 : existing.available) !== null && _d !== void 0 ? _d : false),
        description: sanitizeText(body.description, 240),
        introHighlights: normalizeIntroHighlights(body.introHighlights),
        complianceEnabled,
        complianceDisplay: complianceEnabled ? normalizeProductComplianceDisplay(body.complianceDisplay) : undefined,
        fulfillmentMode: normalizeFulfillmentMode(body.fulfillmentMode, (_e = existing === null || existing === void 0 ? void 0 : existing.fulfillmentMode) !== null && _e !== void 0 ? _e : 'immediate'),
        sort: normalizeSort(body.sort, (_f = existing === null || existing === void 0 ? void 0 : existing.sort) !== null && _f !== void 0 ? _f : 999),
        status: normalizeConfigStatus(body.status),
        createdAt: (_g = existing === null || existing === void 0 ? void 0 : existing.createdAt) !== null && _g !== void 0 ? _g : now,
        updatedAt: now,
    };
}
function normalizeMemberPlanInput(body, existing, fallbackPid) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const now = Date.now();
    const productCode = (_a = existing === null || existing === void 0 ? void 0 : existing.productCode) !== null && _a !== void 0 ? _a : sanitizeText(body.productCode, 60);
    const planCode = (_b = existing === null || existing === void 0 ? void 0 : existing.planCode) !== null && _b !== void 0 ? _b : sanitizeText(body.planCode, 60);
    const productName = sanitizeText(body.productName, 60) || (existing === null || existing === void 0 ? void 0 : existing.productName) || '';
    const planName = sanitizeText(body.planName, 60) || (existing === null || existing === void 0 ? void 0 : existing.planName) || '';
    const complianceEnabled = sanitizeBoolean(body.complianceEnabled, (_c = existing === null || existing === void 0 ? void 0 : existing.complianceEnabled) !== null && _c !== void 0 ? _c : Boolean(existing === null || existing === void 0 ? void 0 : existing.complianceDisplay));
    if (!productCode) {
        throw withStatus(new Error('商品编码不能为空'), 422);
    }
    if (!productName) {
        throw withStatus(new Error('商品名称不能为空'), 422);
    }
    if (!planCode) {
        throw withStatus(new Error('套餐编码不能为空'), 422);
    }
    if (!planName) {
        throw withStatus(new Error('套餐名称不能为空'), 422);
    }
    const pid = (_e = (_d = existing === null || existing === void 0 ? void 0 : existing.pid) !== null && _d !== void 0 ? _d : fallbackPid) !== null && _e !== void 0 ? _e : generatePlanPid(productCode, planCode);
    return {
        pid,
        productCode,
        productName,
        planCode,
        planName,
        virtualPaymentProductId: sanitizeText(body.virtualPaymentProductId, 100),
        price: sanitizePrice(body.price),
        totalAiPoints: sanitizeNumber(body.totalAiPoints),
        durationDays: sanitizeNumber(body.durationDays),
        autoRenewEnabled: sanitizeBoolean(body.autoRenewEnabled, (_f = existing === null || existing === void 0 ? void 0 : existing.autoRenewEnabled) !== null && _f !== void 0 ? _f : false),
        complianceEnabled,
        status: normalizeConfigStatus(body.status),
        sort: normalizeSort(body.sort, (_g = existing === null || existing === void 0 ? void 0 : existing.sort) !== null && _g !== void 0 ? _g : 999),
        description: sanitizeText(body.description, 240),
        complianceDisplay: complianceEnabled ? requirePlanComplianceDisplay(body.complianceDisplay) : undefined,
        createdAt: (_h = existing === null || existing === void 0 ? void 0 : existing.createdAt) !== null && _h !== void 0 ? _h : now,
        updatedAt: now,
    };
}
async function getStoredPointsConfigRecord() {
    await (0, db_1.ensureCollection)('pointsConfig');
    const records = await readCollection('pointsConfig');
    return records.find((record) => record.configId === points_config_1.POINTS_CONFIG_ID);
}
function normalizePointsConfigInput(body, existing) {
    var _a;
    const now = Date.now();
    return (0, points_config_1.normalizePointsConfigRecord)({
        ...body,
        configId: points_config_1.POINTS_CONFIG_ID,
        createdAt: (_a = existing === null || existing === void 0 ? void 0 : existing.createdAt) !== null && _a !== void 0 ? _a : now,
        updatedAt: now,
    });
}
function normalizeAppConfigRecord(body) {
    const updatedAtMs = Date.now();
    return {
        enableHomeAuthModal: sanitizeBoolean(body.enableHomeAuthModal, true),
        enableProductComplianceMode: sanitizeBoolean(body.enableProductComplianceMode, false),
        paymentType: (0, payment_config_1.normalizePaymentType)(body.paymentType),
        updatedAt: toIsoTime(updatedAtMs),
        updatedAtMs,
    };
}
async function getStoredAppConfig() {
    await (0, db_1.ensureCollection)('appConfig');
    try {
        const result = await adminCollection('appConfig').doc('client').get();
        const record = result.data && typeof result.data === 'object' ? result.data : {};
        const updatedAt = typeof record.updatedAt === 'number' ? toIsoTime(record.updatedAt) : '';
        return {
            enableHomeAuthModal: sanitizeBoolean(record.enableHomeAuthModal, true),
            enableProductComplianceMode: sanitizeBoolean(record.enableProductComplianceMode, false),
            paymentType: (0, payment_config_1.normalizePaymentType)(record.paymentType),
            updatedAt,
        };
    }
    catch (_a) {
        return {
            enableHomeAuthModal: true,
            enableProductComplianceMode: false,
            paymentType: 'virtual',
            updatedAt: '',
        };
    }
}
async function getAdminAppConfig(event) {
    return ok(event, await getStoredAppConfig());
}
async function updateAdminAppConfig(event) {
    await (0, db_1.ensureCollection)('appConfig');
    const normalized = normalizeAppConfigRecord(parseBody(event));
    let enableNewsAuthModal = true;
    try {
        const result = await adminCollection('appConfig').doc('client').get();
        const record = result.data && typeof result.data === 'object' ? result.data : {};
        enableNewsAuthModal = sanitizeBoolean(record.enableNewsAuthModal, true);
    }
    catch (_a) {
        enableNewsAuthModal = true;
    }
    await adminCollection('appConfig').doc('client').set({
        data: {
            enableHomeAuthModal: normalized.enableHomeAuthModal,
            enableNewsAuthModal,
            enableProductComplianceMode: normalized.enableProductComplianceMode,
            paymentType: normalized.paymentType,
            updatedAt: normalized.updatedAtMs,
        },
    });
    return ok(event, {
        enableHomeAuthModal: normalized.enableHomeAuthModal,
        enableProductComplianceMode: normalized.enableProductComplianceMode,
        paymentType: normalized.paymentType,
        updatedAt: normalized.updatedAt,
    });
}
async function listUsers(event) {
    const [users, memberships] = await Promise.all([
        readCollection('users'),
        readCollection('memberships'),
    ]);
    const data = users
        .sort((left, right) => right.createdAt - left.createdAt)
        .slice(0, 200)
        .map((user) => toUserView(user, memberships));
    return ok(event, data);
}
async function updateUser(event, userId) {
    const body = parseBody(event);
    const status = body.status === 'disabled' ? 'disabled' : 'active';
    const points = sanitizeNumber(body.points);
    await adminCollection('users').doc(userId).update({
        data: {
            nickname: sanitizeText(body.nickname, 40),
            status,
            pointsBalance: points,
            updatedAt: Date.now(),
        },
    });
    return listUsers(event);
}
async function deleteDocument(event, name, id) {
    const body = parseBody(event);
    if (body.confirm !== 'DELETE') {
        return fail(event, 400, '删除操作缺少二次确认');
    }
    await adminCollection(name).doc(id).remove();
    return ok(event, { deleted: true });
}
async function listOrders(event) {
    const [orders, users] = await Promise.all([
        readCollection('orders'),
        readCollection('users'),
    ]);
    const userMap = new Map(users.map((user) => [user._id, user]));
    const data = orders
        .sort((left, right) => { var _a, _b; return ((_a = right.paidAt) !== null && _a !== void 0 ? _a : right.createdAt) - ((_b = left.paidAt) !== null && _b !== void 0 ? _b : left.createdAt); })
        .slice(0, 200)
        .map((order) => toOrderView(order, userMap));
    return ok(event, data);
}
function normalizeOrderUpdate(body) {
    const status = body.status;
    const update = {
        productName: sanitizeText(body.productName, 60),
        planName: sanitizeText(body.productName, 60),
        amount: sanitizeNumber(body.amountCents),
        fulfillmentStatus: sanitizeText(body.fulfillmentStatus, 30),
        updatedAt: Date.now(),
    };
    if (status === 'pending') {
        update.payStatus = 'pending';
        update.fulfillmentStatus = 'pending';
    }
    else if (status === 'paid') {
        update.payStatus = 'paid';
        update.fulfillmentStatus = 'opening';
    }
    else if (status === 'fulfilled') {
        update.payStatus = 'paid';
        update.fulfillmentStatus = 'fulfilled';
    }
    else if (status === 'refunded') {
        update.payStatus = 'refunded';
    }
    else if (status === 'closed') {
        update.payStatus = 'closed';
    }
    return update;
}
async function updateOrder(event, orderId) {
    const body = parseBody(event);
    await adminCollection('orders').doc(orderId).update({ data: normalizeOrderUpdate(body) });
    return listOrders(event);
}
function normalizeNewsInput(body, existing) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const now = Date.now();
    const title = sanitizeText(body.title, 80);
    const summary = sanitizeText(body.summary, 240);
    const sourceName = sanitizeText(body.sourceName, 40) || '编辑精选';
    const status = body.status === 'published' || body.status === 'archived' ? body.status : 'draft';
    const publishedAt = typeof body.publishAt === 'string' ? Date.parse(body.publishAt) : Number(body.publishAt);
    if (!title) {
        throw withStatus(new Error('资讯标题不能为空'), 422);
    }
    return {
        title,
        summary,
        contentMarkdown: (_a = existing === null || existing === void 0 ? void 0 : existing.contentMarkdown) !== null && _a !== void 0 ? _a : summary,
        sourceName,
        sourcePlatform: (_b = existing === null || existing === void 0 ? void 0 : existing.sourcePlatform) !== null && _b !== void 0 ? _b : 'manual',
        tags: (_c = existing === null || existing === void 0 ? void 0 : existing.tags) !== null && _c !== void 0 ? _c : [],
        viewCount: Number((_d = existing === null || existing === void 0 ? void 0 : existing.viewCount) !== null && _d !== void 0 ? _d : 0),
        likeCount: Number((_e = existing === null || existing === void 0 ? void 0 : existing.likeCount) !== null && _e !== void 0 ? _e : 0),
        repostCount: Number((_f = existing === null || existing === void 0 ? void 0 : existing.repostCount) !== null && _f !== void 0 ? _f : 0),
        commentCount: Number((_g = existing === null || existing === void 0 ? void 0 : existing.commentCount) !== null && _g !== void 0 ? _g : 0),
        score: Number((_h = existing === null || existing === void 0 ? void 0 : existing.score) !== null && _h !== void 0 ? _h : 0),
        status,
        publishedAt: Number.isFinite(publishedAt) ? publishedAt : now,
        createdAt: (_j = existing === null || existing === void 0 ? void 0 : existing.createdAt) !== null && _j !== void 0 ? _j : now,
        updatedAt: now,
    };
}
async function listNews(event) {
    await (0, db_1.ensureCollection)('aiNews');
    const records = await readCollection('aiNews');
    const data = records
        .sort((left, right) => right.publishedAt - left.publishedAt)
        .slice(0, 200)
        .map(toNewsView);
    return ok(event, data);
}
async function createNews(event) {
    const record = normalizeNewsInput(parseBody(event));
    await (0, db_1.ensureCollection)('aiNews');
    await adminCollection('aiNews').add({ data: record });
    return listNews(event);
}
async function updateNews(event, newsId) {
    const doc = await adminCollection('aiNews').doc(newsId).get();
    const existing = doc.data;
    await adminCollection('aiNews').doc(newsId).update({ data: normalizeNewsInput(parseBody(event), existing) });
    return listNews(event);
}
async function listTools(event) {
    await (0, db_1.ensureCollection)('aiTools');
    const [records, runCounts] = await Promise.all([
        readCollection('aiTools'),
        getToolRunCounts(),
    ]);
    const data = mergeToolRecords(records)
        .sort((left, right) => (0, ai_tool_config_1.normalizeAiToolSortOrder)(left.sortOrder, 999) - (0, ai_tool_config_1.normalizeAiToolSortOrder)(right.sortOrder, 999))
        .slice(0, 200)
        .map((record) => toToolView(record, runCounts));
    return ok(event, data);
}
function normalizeToolInput(body, existing, fallbackToolId) {
    var _a, _b, _c, _d, _e, _f;
    const now = Date.now();
    const name = sanitizeText(body.name, 40) || (0, ai_tool_config_1.sanitizeAiToolConfigText)(body.cardTitle, 40);
    if (!name) {
        throw withStatus(new Error('工具名称不能为空'), 422);
    }
    const requestedToolId = sanitizeText(body.toolId, 60);
    const toolId = ((_b = (_a = existing === null || existing === void 0 ? void 0 : existing.toolId) !== null && _a !== void 0 ? _a : fallbackToolId) !== null && _b !== void 0 ? _b : requestedToolId) || createCustomToolId(name);
    return {
        toolId,
        name,
        category: normalizeToolCategory(body.category),
        status: normalizeToolStatus(body.status),
        runCount: Number((_c = existing === null || existing === void 0 ? void 0 : existing.runCount) !== null && _c !== void 0 ? _c : 0),
        pointCost: sanitizeNumber(body.pointCost),
        trialLimit: sanitizeNumber(body.trialLimit),
        createdAt: (_d = existing === null || existing === void 0 ? void 0 : existing.createdAt) !== null && _d !== void 0 ? _d : now,
        updatedAt: now,
        builtIn: (_e = existing === null || existing === void 0 ? void 0 : existing.builtIn) !== null && _e !== void 0 ? _e : isBuiltInAdminTool(toolId),
        deleted: false,
        cardTitle: (0, ai_tool_config_1.sanitizeAiToolConfigText)(body.cardTitle, 40) || name,
        cardDescription: (0, ai_tool_config_1.sanitizeAiToolConfigText)(body.cardDescription, 120),
        cardBadge: (0, ai_tool_config_1.sanitizeAiToolConfigText)(body.cardBadge, 20),
        tags: (0, ai_tool_config_1.normalizeAiToolTags)(body.tags, [(0, ai_tool_config_1.sanitizeAiToolConfigText)(body.cardBadge, 20)].filter(Boolean)),
        icon: (0, ai_tool_config_1.sanitizeAiToolConfigText)(body.icon, 8),
        iconImageFileId: (0, ai_tool_config_1.sanitizeAiToolConfigText)(body.iconImageFileId, 500),
        visible: body.visible !== false,
        sortOrder: (0, ai_tool_config_1.normalizeAiToolSortOrder)(body.sortOrder, (_f = existing === null || existing === void 0 ? void 0 : existing.sortOrder) !== null && _f !== void 0 ? _f : 999),
        outputType: normalizeToolOutputType(body.outputType, existing === null || existing === void 0 ? void 0 : existing.outputType),
        workerModel: (0, ai_tool_config_1.normalizeAiToolWorkerModel)(body.workerModel, existing === null || existing === void 0 ? void 0 : existing.workerModel),
        intro: (0, ai_tool_config_1.normalizeAiToolIntroConfig)(body.intro),
    };
}
async function createTool(event) {
    await (0, db_1.ensureCollection)('aiTools');
    await adminCollection('aiTools').add({ data: normalizeToolInput(parseBody(event)) });
    return listTools(event);
}
async function updateTool(event, toolId) {
    await (0, db_1.ensureCollection)('aiTools');
    const records = await readCollection('aiTools');
    const existing = findToolRecord(records, toolId);
    const record = normalizeToolInput(parseBody(event), existing, toolId);
    if (existing) {
        await adminCollection('aiTools').doc(existing._id).update({ data: record });
    }
    else {
        await adminCollection('aiTools').add({ data: record });
    }
    return listTools(event);
}
async function deleteTool(event, toolId) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
    const body = parseBody(event);
    if (body.confirm !== 'DELETE') {
        return fail(event, 400, '删除操作缺少二次确认');
    }
    await (0, db_1.ensureCollection)('aiTools');
    const records = await readCollection('aiTools');
    const existing = findToolRecord(records, toolId);
    const targetToolId = (_a = existing === null || existing === void 0 ? void 0 : existing.toolId) !== null && _a !== void 0 ? _a : toolId;
    if (isBuiltInAdminTool(targetToolId)) {
        const now = Date.now();
        const defaultDefinition = (0, ai_tool_config_1.getDefaultAdminToolDefinitions)().find((definition) => definition.toolId === targetToolId);
        const baseRecord = defaultDefinition ? (0, ai_tool_config_1.buildDefaultAiToolRecord)(defaultDefinition) : undefined;
        const deletedRecord = {
            ...(baseRecord ? getWritableToolRecord(baseRecord) : {}),
            ...(existing ? getWritableToolRecord(existing) : {}),
            toolId: targetToolId,
            name: (_c = (_b = existing === null || existing === void 0 ? void 0 : existing.name) !== null && _b !== void 0 ? _b : baseRecord === null || baseRecord === void 0 ? void 0 : baseRecord.name) !== null && _c !== void 0 ? _c : targetToolId,
            category: (_e = (_d = existing === null || existing === void 0 ? void 0 : existing.category) !== null && _d !== void 0 ? _d : baseRecord === null || baseRecord === void 0 ? void 0 : baseRecord.category) !== null && _e !== void 0 ? _e : 'text',
            status: 'disabled',
            runCount: Number((_g = (_f = existing === null || existing === void 0 ? void 0 : existing.runCount) !== null && _f !== void 0 ? _f : baseRecord === null || baseRecord === void 0 ? void 0 : baseRecord.runCount) !== null && _g !== void 0 ? _g : 0),
            pointCost: Number((_j = (_h = existing === null || existing === void 0 ? void 0 : existing.pointCost) !== null && _h !== void 0 ? _h : baseRecord === null || baseRecord === void 0 ? void 0 : baseRecord.pointCost) !== null && _j !== void 0 ? _j : 0),
            trialLimit: Number((_l = (_k = existing === null || existing === void 0 ? void 0 : existing.trialLimit) !== null && _k !== void 0 ? _k : baseRecord === null || baseRecord === void 0 ? void 0 : baseRecord.trialLimit) !== null && _l !== void 0 ? _l : 0),
            tags: (0, ai_tool_config_1.normalizeAiToolTags)(existing === null || existing === void 0 ? void 0 : existing.tags, (_m = baseRecord === null || baseRecord === void 0 ? void 0 : baseRecord.tags) !== null && _m !== void 0 ? _m : []),
            sortOrder: (0, ai_tool_config_1.normalizeAiToolSortOrder)(existing === null || existing === void 0 ? void 0 : existing.sortOrder, (_o = baseRecord === null || baseRecord === void 0 ? void 0 : baseRecord.sortOrder) !== null && _o !== void 0 ? _o : 999),
            createdAt: (_q = (_p = existing === null || existing === void 0 ? void 0 : existing.createdAt) !== null && _p !== void 0 ? _p : baseRecord === null || baseRecord === void 0 ? void 0 : baseRecord.createdAt) !== null && _q !== void 0 ? _q : now,
            updatedAt: now,
            builtIn: true,
            deleted: true,
        };
        if (existing) {
            await adminCollection('aiTools').doc(existing._id).update({ data: deletedRecord });
        }
        else {
            await adminCollection('aiTools').add({ data: deletedRecord });
        }
        return ok(event, { deleted: true });
    }
    if (!existing) {
        return fail(event, 404, '工具不存在');
    }
    await adminCollection('aiTools').doc(existing._id).remove();
    return ok(event, { deleted: true });
}
async function listProductTypes(event) {
    await (0, db_1.ensureCollection)('productTypes');
    const records = await readCollection('productTypes');
    const data = records
        .sort((left, right) => normalizeSort(left.sort, 999) - normalizeSort(right.sort, 999))
        .slice(0, 200)
        .map(toProductTypeView);
    return ok(event, data);
}
async function createProductType(event) {
    await (0, db_1.ensureCollection)('productTypes');
    await adminCollection('productTypes').add({ data: normalizeProductTypeInput(parseBody(event)) });
    return listProductTypes(event);
}
async function updateProductType(event, productId) {
    await (0, db_1.ensureCollection)('productTypes');
    const records = await readCollection('productTypes');
    const existing = findProductTypeRecord(records, productId);
    const record = normalizeProductTypeInput(parseBody(event), existing, productId);
    if (existing) {
        await adminCollection('productTypes').doc(existing._id).update({ data: record });
    }
    else {
        await adminCollection('productTypes').add({ data: record });
    }
    return listProductTypes(event);
}
async function deleteProductType(event, productId) {
    const body = parseBody(event);
    if (body.confirm !== 'DELETE') {
        return fail(event, 400, '删除操作缺少二次确认');
    }
    await (0, db_1.ensureCollection)('productTypes');
    const records = await readCollection('productTypes');
    const existing = findProductTypeRecord(records, productId);
    if (!existing) {
        return fail(event, 404, '商品类型不存在');
    }
    await adminCollection('productTypes').doc(existing._id).remove();
    return ok(event, { deleted: true });
}
async function listMemberPlans(event) {
    await (0, db_1.ensureCollection)('memberPlans');
    const records = await readCollection('memberPlans');
    const data = records
        .sort((left, right) => normalizeSort(left.sort, 999) - normalizeSort(right.sort, 999))
        .slice(0, 300)
        .map(toMemberPlanView);
    return ok(event, data);
}
async function createMemberPlan(event) {
    await (0, db_1.ensureCollection)('memberPlans');
    await adminCollection('memberPlans').add({ data: normalizeMemberPlanInput(parseBody(event)) });
    return listMemberPlans(event);
}
async function updateMemberPlan(event, planId) {
    await (0, db_1.ensureCollection)('memberPlans');
    const records = await readCollection('memberPlans');
    const existing = findMemberPlanRecord(records, planId);
    const record = normalizeMemberPlanInput(parseBody(event), existing, planId);
    if (existing) {
        await adminCollection('memberPlans').doc(existing._id).update({ data: record });
    }
    else {
        await adminCollection('memberPlans').add({ data: record });
    }
    return listMemberPlans(event);
}
async function deleteMemberPlan(event, planId) {
    const body = parseBody(event);
    if (body.confirm !== 'DELETE') {
        return fail(event, 400, '删除操作缺少二次确认');
    }
    await (0, db_1.ensureCollection)('memberPlans');
    const records = await readCollection('memberPlans');
    const existing = findMemberPlanRecord(records, planId);
    if (!existing) {
        return fail(event, 404, '套餐不存在');
    }
    await adminCollection('memberPlans').doc(existing._id).remove();
    return ok(event, { deleted: true });
}
async function getAdminPointsConfig(event) {
    const config = await (0, points_config_1.getPointsConfig)();
    return ok(event, toPointsConfigView(config));
}
async function updateAdminPointsConfig(event) {
    const existing = await getStoredPointsConfigRecord();
    const record = normalizePointsConfigInput(parseBody(event), existing);
    if (existing) {
        await adminCollection('pointsConfig').doc(existing._id).update({ data: record });
    }
    else {
        await adminCollection('pointsConfig').add({ data: record });
    }
    return ok(event, toPointsConfigView(record));
}
async function getDashboard(event) {
    const [usersResponse, ordersResponse, newsResponse, toolsResponse] = await Promise.all([
        listUsers(event),
        listOrders(event),
        listNews(event),
        listTools(event),
    ]);
    const users = JSON.parse(usersResponse.body).data;
    const orders = JSON.parse(ordersResponse.body).data;
    const news = JSON.parse(newsResponse.body).data;
    const tools = JSON.parse(toolsResponse.body).data;
    const paidOrders = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
    const revenue = paidOrders.reduce((sum, order) => sum + order.amountCents, 0);
    const toolRuns = tools.reduce((sum, tool) => sum + tool.runCount, 0);
    const data = {
        metrics: [
            { id: 'users', label: '用户总数', value: users.length.toLocaleString('zh-CN'), detail: '后台当前可见用户' },
            { id: 'orders', label: '订单收入', value: `¥${(revenue / 100).toLocaleString('zh-CN')}`, detail: `${paidOrders.length} 个已支付订单` },
            { id: 'news', label: 'AI 新闻', value: news.length.toLocaleString('zh-CN'), detail: `${news.filter((item) => item.status === 'published').length} 篇已发布` },
            { id: 'tools', label: '工具调用', value: toolRuns.toLocaleString('zh-CN'), detail: `${tools.length} 个后台配置工具` },
        ],
        recentOrders: orders.slice(0, 5),
        recentNews: news.slice(0, 5),
    };
    return ok(event, data);
}
async function route(event) {
    const method = getMethod(event);
    if (method === 'OPTIONS') {
        return jsonResponse(event, 204, null);
    }
    assertAdminToken(event);
    const path = getPath(event);
    if (path.replace(/^\/admin-api/, '') === '/dashboard' && method === 'GET') {
        return getDashboard(event);
    }
    if (path.replace(/^\/admin-api/, '') === '/tool-assets' && method === 'POST') {
        return uploadToolAsset(event);
    }
    if (path.replace(/^\/admin-api/, '') === '/tool-assets/chunks' && method === 'POST') {
        return uploadToolAssetChunk(event);
    }
    if (path.replace(/^\/admin-api/, '') === '/files/chunks' && method === 'POST') {
        return uploadAdminFileChunk(event);
    }
    if (path.replace(/^\/admin-api/, '') === '/points-config' && method === 'GET') {
        return getAdminPointsConfig(event);
    }
    if (path.replace(/^\/admin-api/, '') === '/points-config' && method === 'PATCH') {
        return updateAdminPointsConfig(event);
    }
    if (path.replace(/^\/admin-api/, '') === '/app-config' && method === 'GET') {
        return getAdminAppConfig(event);
    }
    if (path.replace(/^\/admin-api/, '') === '/app-config' && method === 'PATCH') {
        return updateAdminAppConfig(event);
    }
    const matched = matchRoute(path);
    const { resource, id } = matched;
    if (!resource) {
        return fail(event, 404, '后台接口不存在');
    }
    if (method === 'GET' && !id) {
        if (resource === 'users')
            return listUsers(event);
        if (resource === 'orders')
            return listOrders(event);
        if (resource === 'news')
            return listNews(event);
        if (resource === 'tools')
            return listTools(event);
        if (resource === 'product-types')
            return listProductTypes(event);
        if (resource === 'files')
            return listAdminFiles(event);
        return listMemberPlans(event);
    }
    if (method === 'POST' && !id) {
        if (resource === 'news')
            return createNews(event);
        if (resource === 'tools')
            return createTool(event);
        if (resource === 'product-types')
            return createProductType(event);
        if (resource === 'plans')
            return createMemberPlan(event);
        if (resource === 'files')
            return uploadAdminFile(event);
        return fail(event, 405, '用户和订单不支持后台新增');
    }
    if (method === 'PATCH' && id) {
        if (resource === 'users')
            return updateUser(event, id);
        if (resource === 'orders')
            return updateOrder(event, id);
        if (resource === 'news')
            return updateNews(event, id);
        if (resource === 'tools')
            return updateTool(event, id);
        if (resource === 'product-types')
            return updateProductType(event, id);
        if (resource === 'files')
            return updateAdminFile(event, id);
        return updateMemberPlan(event, id);
    }
    if (method === 'DELETE' && id) {
        if (resource === 'users')
            return deleteDocument(event, 'users', id);
        if (resource === 'orders')
            return deleteDocument(event, 'orders', id);
        if (resource === 'news')
            return deleteDocument(event, 'aiNews', id);
        if (resource === 'tools')
            return deleteTool(event, id);
        if (resource === 'product-types')
            return deleteProductType(event, id);
        if (resource === 'files')
            return deleteAdminFile(event, id);
        return deleteMemberPlan(event, id);
    }
    return fail(event, 405, '请求方法不支持');
}
async function main(event) {
    var _a;
    try {
        return await route(event);
    }
    catch (error) {
        const statusCode = (_a = error.statusCode) !== null && _a !== void 0 ? _a : 500;
        const message = error instanceof Error ? error.message : '后台接口异常';
        return fail(event, statusCode, statusCode >= 500 ? '后台接口异常' : message);
    }
}
