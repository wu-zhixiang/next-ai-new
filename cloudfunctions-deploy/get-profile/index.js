"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const constants_1 = require("./shared/constants");
const db_1 = require("./shared/db");
const context_1 = require("./_lib/context");
const utils_1 = require("./shared/utils");
async function main() {
    var _a, _b, _c;
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        return (0, utils_1.ok)({
            mobile: '',
            mobileBound: false,
            nickname: '',
            avatarUrl: '',
            membershipStatus: 'none',
            subscribeMsgAuth: false,
            newsSubscribeMsgAuth: false,
            newsSubscribeMsgQuota: 0,
        });
    }
    const membership = (_b = (_a = (await (0, db_1.getMembershipByUserId)(user._id, constants_1.DEFAULT_PRODUCT_CODE))) !== null && _a !== void 0 ? _a : (await (0, db_1.listMembershipsByUserId)(user._id)).find((item) => item.status === 'active' || item.status === 'opening')) !== null && _b !== void 0 ? _b : null;
    return (0, utils_1.ok)({
        mobile: (0, utils_1.maskMobile)(user.mobile),
        mobileBound: Boolean(user.mobile),
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        membershipStatus: (_c = membership === null || membership === void 0 ? void 0 : membership.status) !== null && _c !== void 0 ? _c : 'none',
        membershipProductCode: membership === null || membership === void 0 ? void 0 : membership.productCode,
        membershipProductName: membership === null || membership === void 0 ? void 0 : membership.productName,
        subscribeMsgAuth: user.subscribeMsgAuth,
        newsSubscribeMsgAuth: Boolean(user.newsSubscribeMsgAuth),
        newsSubscribeMsgQuota: (_a = user.newsSubscribeMsgQuota) !== null && _a !== void 0 ? _a : 0,
    });
}
