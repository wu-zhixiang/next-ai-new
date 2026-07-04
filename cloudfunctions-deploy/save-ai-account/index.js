"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
function normalizeEmail(event) {
    var _a, _b;
    const raw = ((_b = (_a = event.accountName) !== null && _a !== void 0 ? _a : event.email) !== null && _b !== void 0 ? _b : '').trim().toLowerCase();
    return raw;
}
function assertValidEmail(email) {
    if (!email) {
        throw new Error('请输入账号邮箱');
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error('请输入正确的邮箱账号');
    }
}
async function main(event) {
    const email = normalizeEmail(event);
    assertValidEmail(email);
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
            aiAccountPasswordEncrypted: '',
            updatedAt: now,
        },
    });
    return (0, utils_1.ok)({
        aiAccountRegistered: true,
        aiAccountEmail: email,
    });
}
