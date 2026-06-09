"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const context_1 = require("./_lib/context");
const utils_1 = require("./shared/utils");
async function main(event) {
    const { OPENID } = (0, context_1.getWxContext)();
    console.info('subscribe-auth.save.request', {
        openid: OPENID,
        scene: event.scene || 'member',
        accepted: event.accepted,
    });
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
            newsSubscribeMsgAuth: event.accepted,
            newsSubscribeMsgAuthAt: event.accepted ? now : undefined,
            newsSubscribeMsgQuota: event.accepted ? db_1._.inc(1) : 0,
            updatedAt: now,
        }
        : {
            subscribeMsgAuth: event.accepted,
            subscribeMsgAuthAt: event.accepted ? now : undefined,
            updatedAt: now,
        };
    await (0, db_1.collection)('users').doc(user._id).update({
        data,
    });
    console.info('subscribe-auth.save.success', {
        openid: OPENID,
        userId: user._id,
        scene: event.scene || 'member',
        accepted: event.accepted,
    });
    return (0, utils_1.ok)({ success: true });
}
