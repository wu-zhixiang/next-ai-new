"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
async function main() {
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        throw new Error('请先登录后再查看验证码');
    }
    if (!user.aiAccountEmail) {
        throw new Error('当前用户未绑定 AI 账号');
    }
    const latestValidCode = await (0, db_1.getLatestEmailVerificationCode)(user._id);
    const latestCode = latestValidCode !== null && latestValidCode !== void 0 ? latestValidCode : await (0, db_1.getLatestUnusedEmailVerificationCode)(user._id);
    if (!latestCode) {
        console.info(JSON.stringify({
            tag: 'emailCode.latest.missing',
            userId: user._id,
            email: user.aiAccountEmail,
        }));
        return (0, utils_1.ok)({
            hasCode: false,
            email: user.aiAccountEmail,
        });
    }
    console.info(JSON.stringify({
        tag: 'emailCode.latest.found',
        userId: user._id,
        email: latestCode.email,
        codeId: latestCode._id,
        expired: latestCode.expiresAt <= Date.now(),
        used: Boolean(latestCode.usedAt),
    }));
    return (0, utils_1.ok)({
        hasCode: true,
        codeId: latestCode._id,
        email: latestCode.email,
        code: latestCode.code,
        provider: latestCode.provider,
        receivedAt: latestCode.receivedAt,
        expiresAt: latestCode.expiresAt,
        expired: latestCode.expiresAt <= Date.now(),
    });
}
