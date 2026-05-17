"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const context_1 = require("./_lib/context");
const utils_1 = require("./shared/utils");
async function main(event) {
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        throw new Error('用户未登录');
    }
    await (0, db_1.collection)('users').doc(user._id).update({
        data: {
            subscribeMsgAuth: event.accepted,
            subscribeMsgAuthAt: event.accepted ? Date.now() : undefined,
            updatedAt: Date.now(),
        },
    });
    return (0, utils_1.ok)({ success: true });
}
