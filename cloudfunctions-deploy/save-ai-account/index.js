"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const ai_account_1 = require("./shared/ai-account");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
const AI_ACCOUNT_DOMAIN = 'mraclpivot.com';
function normalizeAccountName(event) {
    var _a, _b;
    const raw = ((_b = (_a = event.accountName) !== null && _a !== void 0 ? _a : event.email) !== null && _b !== void 0 ? _b : '').trim().toLowerCase();
    return raw.endsWith(`@${AI_ACCOUNT_DOMAIN}`)
        ? raw.slice(0, -AI_ACCOUNT_DOMAIN.length - 1)
        : raw;
}
function assertValidAccountName(accountName) {
    if (!/^[a-z][a-z0-9._-]{2,31}$/.test(accountName)) {
        throw new Error('账号需为3-32位小写字母开头，可含数字、点、下划线或中划线');
    }
    if (accountName.includes('..') || accountName.startsWith('.') || accountName.endsWith('.')) {
        throw new Error('账号格式不正确，请调整点号位置');
    }
}
function assertValidPassword(password) {
    if (password.length < 8 || password.length > 64) {
        throw new Error('密码需为 8-64 位');
    }
    if (/\s/.test(password)) {
        throw new Error('密码不能包含空格');
    }
    if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
        throw new Error('密码需包含大小写字母、数字和特殊符号');
    }
}
async function main(event) {
    var _a;
    const accountName = normalizeAccountName(event);
    const email = `${accountName}@${AI_ACCOUNT_DOMAIN}`;
    const password = (_a = event.password) !== null && _a !== void 0 ? _a : '';
    assertValidAccountName(accountName);
    if (!password) {
        throw new Error('请输入账号密码');
    }
    assertValidPassword(password);
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        throw new Error('请先登录后再注册 AI 账号');
    }
    const now = Date.now();
    await (0, db_1.collection)('users').doc(user._id).update({
        data: {
            aiAccountRegistered: true,
            aiAccountEmail: email,
            aiAccountPasswordEncrypted: (0, ai_account_1.encryptAiAccountPassword)(password),
            updatedAt: now,
        },
    });
    return (0, utils_1.ok)({
        aiAccountRegistered: true,
        aiAccountEmail: email,
    });
}
