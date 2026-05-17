"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const ai_account_1 = require("./shared/ai-account");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
async function main() {
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        throw new Error('请先登录后再查看账号信息');
    }
    if (!user.aiAccountEmail || !user.aiAccountPasswordEncrypted) {
        throw new Error('暂未注册 AI 账号');
    }
    return (0, utils_1.ok)({
        email: user.aiAccountEmail,
        password: (0, ai_account_1.decryptAiAccountPassword)(user.aiAccountPasswordEncrypted),
    });
}
