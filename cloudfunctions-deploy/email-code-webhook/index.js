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
    const appleEmail = isAppleEmail(payload.from, payload.subject);
    const code = appleEmail ? normalizeAppleCode(payload) : normalizeCode(payload.code, payload.subject, payload.text, payload.html, payload.content);
    if (!email.endsWith(EMAIL_DOMAIN)) {
        throw new Error('邮箱域名不合法');
    }
    if (!code) {
        throw new Error('验证码格式不合法');
    }
    const receivedAt = normalizeReceivedAt(payload.receivedAt);
    if (appleEmail) {
        const record = {
            email,
            code,
            from: (_a = payload.from) !== null && _a !== void 0 ? _a : '',
            subject: (_b = payload.subject) !== null && _b !== void 0 ? _b : '',
            receivedAt,
            expiresAt: receivedAt + CODE_TTL_MS,
            usedAt: null,
            createdAt: Date.now(),
        };
        await (0, db_1.ensureCollection)('appstoreEmailVerificationCodes');
        await (0, db_1.collection)('appstoreEmailVerificationCodes').add({ data: record });
        console.info(JSON.stringify({
            tag: 'appleEmailCode.saved',
            email,
            provider: 'apple',
            receivedAt,
        }));
        return (0, utils_1.ok)({ success: true });
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
    var _a;
    const raw = (value !== null && value !== void 0 ? value : '').trim().toLowerCase();
    const matched = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
    return ((_a = matched === null || matched === void 0 ? void 0 : matched[0]) !== null && _a !== void 0 ? _a : raw).toLowerCase();
}
function normalizeCode(...values) {
    var _a, _b;
    for (const value of values) {
        const text = (value !== null && value !== void 0 ? value : '').trim();
        const directCode = (_a = text.match(/^\d{6}$/)) === null || _a === void 0 ? void 0 : _a[0];
        if (directCode) {
            return directCode;
        }
        const embeddedCode = (_b = text.match(/(?:^|[^\d])(\d{6})(?:[^\d]|$)/)) === null || _b === void 0 ? void 0 : _b[1];
        if (embeddedCode) {
            return embeddedCode;
        }
    }
    return '';
}
function normalizeAppleCode(payload) {
    const keywordCode = normalizeKeywordCode(payload.subject, payload.text, payload.html, payload.content);
    if (keywordCode) {
        return keywordCode;
    }
    const firstCandidate = normalizeCandidates(payload.candidates)[0];
    if (firstCandidate) {
        return firstCandidate;
    }
    return normalizeCode(payload.code);
}
function normalizeKeywordCode(...values) {
    const patterns = [
        /(?:验证码|驗證碼|临时验证码|一次性代码)[^\d]{0,120}(\d{6})/i,
        /(?:verification code|temporary code|one-time code|login code|code)[^\d]{0,120}(\d{6})/i,
        /(\d{6})[^\d]{0,120}(?:验证码|驗證碼|verification code|temporary code|one-time code|login code)/i,
    ];
    for (const value of values) {
        const text = (value !== null && value !== void 0 ? value : '').replace(/\s+/g, ' ');
        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match === null || match === void 0 ? void 0 : match[1]) {
                return match[1];
            }
        }
    }
    return '';
}
function normalizeCandidates(value) {
    if (!Array.isArray(value)) {
        return [];
    }
    return Array.from(new Set(value.map((item) => String(item).trim()).filter((item) => /^\d{6}$/.test(item))));
}
function normalizeReceivedAt(value) {
    if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
        return Date.now();
    }
    return value < 1000000000000 ? value * 1000 : value;
}
function isOpenAiEmail(value) {
    const from = (value !== null && value !== void 0 ? value : '').toLowerCase();
    return from.includes('openai.com');
}
function isAppleEmail(from, subject) {
    const normalizedFrom = (from !== null && from !== void 0 ? from : '').toLowerCase();
    const normalizedSubject = (subject !== null && subject !== void 0 ? subject : '').toLowerCase();
    return normalizedFrom.includes('apple') || normalizedSubject.includes('apple');
}
