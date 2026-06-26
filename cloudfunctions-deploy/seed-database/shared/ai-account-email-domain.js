"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AI_ACCOUNT_EMAIL_DOMAIN_SEED = exports.getAiAccountEmailSuffix = exports.DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN = void 0;
exports.listAiAccountEmailDomains = listAiAccountEmailDomains;
exports.getAvailableAiAccountEmailDomain = getAvailableAiAccountEmailDomain;
exports.listAllowedAiAccountEmailDomains = listAllowedAiAccountEmailDomains;
exports.seedAiAccountEmailDomains = seedAiAccountEmailDomains;
const db_1 = require("./db");
const ai_account_email_domain_core_1 = require("./ai-account-email-domain-core");
var ai_account_email_domain_core_2 = require("./ai-account-email-domain-core");
Object.defineProperty(exports, "DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN", { enumerable: true, get: function () { return ai_account_email_domain_core_2.DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN; } });
Object.defineProperty(exports, "getAiAccountEmailSuffix", { enumerable: true, get: function () { return ai_account_email_domain_core_2.getAiAccountEmailSuffix; } });
const MISSING_COLLECTION_MESSAGES = [
    'collection not exists',
    'DATABASE_COLLECTION_NOT_EXIST',
    'Table not exist',
    'Db or Table not exist',
];
exports.AI_ACCOUNT_EMAIL_DOMAIN_SEED = [
    {
        domain: ai_account_email_domain_core_1.DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN,
        available: true,
        status: 'on',
        sort: 1,
        note: '默认 AI 账号注册邮箱域名',
        createdAt: 1746921600000,
        updatedAt: 1746921600000,
    },
];
async function listAiAccountEmailDomains() {
    try {
        const result = await (0, db_1.collection)('aiAccountEmailDomains').get();
        return result.data;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (MISSING_COLLECTION_MESSAGES.some((item) => message.includes(item))) {
            return [];
        }
        throw error;
    }
}
async function getAvailableAiAccountEmailDomain() {
    const domains = await listAiAccountEmailDomains();
    const selected = (0, ai_account_email_domain_core_1.selectAvailableAiAccountEmailDomain)(domains);
    if (selected) {
        return selected;
    }
    if (domains.length === 0) {
        return ai_account_email_domain_core_1.DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN;
    }
    throw new Error('暂无可用邮箱域名，请联系管理员配置');
}
async function listAllowedAiAccountEmailDomains() {
    const domains = await listAiAccountEmailDomains();
    const normalized = domains
        .map((item) => (0, ai_account_email_domain_core_1.normalizeAiAccountEmailDomain)(item.domain))
        .filter(Boolean);
    return Array.from(new Set([ai_account_email_domain_core_1.DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN, ...normalized]));
}
async function seedAiAccountEmailDomains(now = Date.now()) {
    await (0, db_1.ensureCollection)('aiAccountEmailDomains');
    for (const seed of exports.AI_ACCOUNT_EMAIL_DOMAIN_SEED) {
        const domain = (0, ai_account_email_domain_core_1.normalizeAiAccountEmailDomain)(seed.domain);
        const existing = await (0, db_1.collection)('aiAccountEmailDomains').where({ domain }).limit(1).get();
        const current = existing.data[0];
        if (current === null || current === void 0 ? void 0 : current._id) {
            continue;
        }
        await (0, db_1.collection)('aiAccountEmailDomains').add({
            data: {
                ...seed,
                domain,
                createdAt: now,
                updatedAt: now,
            },
        });
    }
    return exports.AI_ACCOUNT_EMAIL_DOMAIN_SEED.length;
}
