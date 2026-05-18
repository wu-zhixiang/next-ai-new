"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_DOMAIN = '@mraclpivot.com';
async function main(event = {}) {
    var _a, _b;
    const payload = normalizeEvent(event);
    assertWebhookSecret(event);
    const email = normalizeEmail(payload.to);
    const code = normalizeCode(payload.code);
    if (!email.endsWith(EMAIL_DOMAIN)) {
        throw new Error('邮箱域名不合法');
    }
    if (!code) {
        throw new Error('验证码格式不合法');
    }
    const user = await (0, db_1.getUserByAiAccountEmail)(email);
    if (!user) {
        console.warn(JSON.stringify({
            tag: 'emailCode.userMissing',
            email,
            from: payload.from,
        }));
        return (0, utils_1.ok)({ success: true, ignored: true, reason: 'user_missing' });
    }
    const receivedAt = typeof payload.receivedAt === 'number' ? payload.receivedAt : Date.now();
    const record = {
        email,
        userId: user._id,
        code,
        provider: isOpenAiEmail(payload.from) ? 'openai' : 'unknown',
        from: (_a = payload.from) !== null && _a !== void 0 ? _a : '',
        subject: (_b = payload.subject) !== null && _b !== void 0 ? _b : '',
        receivedAt,
        expiresAt: receivedAt + CODE_TTL_MS,
        usedAt: null,
        createdAt: Date.now(),
    };
    await (0, db_1.collection)('emailVerificationCodes').add({ data: record });
    console.info(JSON.stringify({
        tag: 'emailCode.saved',
        email,
        userId: user._id,
        provider: record.provider,
        receivedAt,
    }));
    return (0, utils_1.ok)({ success: true });
}
function normalizeEvent(event) {
    if (event.body) {
        try {
            return {
                ...event,
                ...JSON.parse(event.body),
            };
        }
        catch (_a) {
            return event;
        }
    }
    return event;
}
function assertWebhookSecret(event) {
    var _a, _b;
    const expected = process.env.EMAIL_WEBHOOK_SECRET;
    if (!expected) {
        throw new Error('EMAIL_WEBHOOK_SECRET 未配置');
    }
    const headers = (_a = event.headers) !== null && _a !== void 0 ? _a : {};
    const actual = (_b = headers['x-email-webhook-secret']) !== null && _b !== void 0 ? _b : headers['X-Email-Webhook-Secret'];
    if (actual !== expected) {
        throw new Error('Webhook secret 不合法');
    }
}
function normalizeEmail(value) {
    return (value !== null && value !== void 0 ? value : '').trim().toLowerCase();
}
function normalizeCode(value) {
    const code = (value !== null && value !== void 0 ? value : '').trim();
    return /^\d{6}$/.test(code) ? code : '';
}
function isOpenAiEmail(value) {
    const from = (value !== null && value !== void 0 ? value : '').toLowerCase();
    return from.includes('openai.com');
}
