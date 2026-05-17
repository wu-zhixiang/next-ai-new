"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
async function main(event) {
    var _a, _b, _c, _d, _e, _f;
    const now = Date.now();
    const { OPENID } = (0, context_1.getWxContext)();
    const existingUser = await (0, db_1.getUserByOpenId)(OPENID);
    if (existingUser) {
        await (0, db_1.collection)('users').doc(existingUser._id).update({
            data: {
                nickname: (_b = (_a = event.nickname) !== null && _a !== void 0 ? _a : existingUser.nickname) !== null && _b !== void 0 ? _b : '',
                avatarUrl: (_d = (_c = event.avatarUrl) !== null && _c !== void 0 ? _c : existingUser.avatarUrl) !== null && _d !== void 0 ? _d : '',
                lastLoginAt: now,
                updatedAt: now,
            },
        });
        return (0, utils_1.ok)({
            userId: existingUser._id,
            mobileBound: Boolean(existingUser.mobile),
            nickname: (_e = event.nickname) !== null && _e !== void 0 ? _e : existingUser.nickname,
            avatarUrl: (_f = event.avatarUrl) !== null && _f !== void 0 ? _f : existingUser.avatarUrl,
        });
    }
    const user = {
        openid: OPENID,
        mobile: '',
        nickname: event.nickname,
        avatarUrl: event.avatarUrl,
        status: 'active',
        subscribeMsgAuth: false,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
    };
    const result = await (0, db_1.collection)('users').add({ data: user });
    return (0, utils_1.ok)({
        userId: result._id,
        mobileBound: false,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
    });
}
