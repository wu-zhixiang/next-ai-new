"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
async function main(event = {}) {
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        throw new Error('请先登录后再操作验证码');
    }
    if (!event.codeId) {
        throw new Error('缺少验证码记录');
    }
    const result = await (0, db_1.collection)('emailVerificationCodes').doc(event.codeId).get();
    const codeRecord = result.data;
    if (!codeRecord || codeRecord.userId !== user._id || codeRecord.email !== user.aiAccountEmail) {
        throw new Error('验证码记录不存在');
    }
    await (0, db_1.collection)('emailVerificationCodes').doc(event.codeId).update({
        data: {
            usedAt: Date.now(),
        },
    });
    return (0, utils_1.ok)({ success: true });
}
