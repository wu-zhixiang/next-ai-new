"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const wechat_1 = require("./shared/wechat");
const context_1 = require("./_lib/context");
async function main(event) {
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        throw new Error('用户未登录');
    }
    let mobile = (0, utils_1.normalizeMobile)(event.mobile);
    if (!mobile && (event.source === 'wechat_phone' || event.code)) {
        if (!event.code) {
            throw new Error('缺少微信手机号授权 code');
        }
        mobile = (0, utils_1.normalizeMobile)(await (0, wechat_1.getWechatPhoneNumber)(event.code));
    }
    if (!mobile) {
        throw new Error('缺少手机号信息');
    }
    if (!(0, utils_1.isValidMainlandMobile)(mobile)) {
        throw new Error('手机号格式不正确');
    }
    await (0, db_1.collection)('users').doc(user._id).update({
        data: {
            mobile,
            updatedAt: Date.now(),
        },
    });
    return (0, utils_1.ok)({
        success: true,
        mobile: (0, utils_1.maskMobile)(mobile),
    });
}
