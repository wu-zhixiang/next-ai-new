"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const context_1 = require("./_lib/context");
const utils_1 = require("./shared/utils");
function normalizeAccepted(value) {
    if (value === true || value === 'true' || value === 1) {
        return true;
    }
    if (value === false || value === 'false' || value === 0) {
        return false;
    }
    return null;
}
async function main(event = {}) {
    const { OPENID } = (0, context_1.getWxContext)();
    const accepted = normalizeAccepted(event.accepted);
    console.info('subscribe-auth.save.request', {
        openid: OPENID,
        scene: event.scene || 'member',
        accepted,
    });
    if (!OPENID) {
        console.warn('subscribe-auth.save.openid-missing', {
            scene: event.scene || 'member',
            accepted,
        });
        throw new Error('未获取到微信登录态，请重新进入小程序后重试');
    }
    if (accepted === null) {
        throw new Error('订阅状态参数不正确');
    }
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        console.warn('subscribe-auth.save.user-missing', {
            openid: OPENID,
            scene: event.scene || 'member',
        });
        throw new Error('用户未登录');
    }
    const now = Date.now();
    const data = event.scene === 'news'
        ? {
            newsSubscribeMsgAuth: accepted,
            newsSubscribeMsgAuthAt: accepted ? now : undefined,
            newsSubscribeMsgQuota: accepted ? db_1._.inc(1) : 0,
            updatedAt: now,
        }
        : {
            subscribeMsgAuth: accepted,
            subscribeMsgAuthAt: accepted ? now : undefined,
            updatedAt: now,
        };
    await (0, db_1.collection)('users').doc(user._id).update({
        data,
    });
    console.info('subscribe-auth.save.success', {
        openid: OPENID,
        userId: user._id,
        scene: event.scene || 'member',
        accepted,
    });
    return (0, utils_1.ok)({ success: true });
}
