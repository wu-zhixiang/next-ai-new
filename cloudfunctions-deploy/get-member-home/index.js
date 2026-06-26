"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const constants_1 = require("./shared/constants");
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const ai_account_email_domain_1 = require("./shared/ai-account-email-domain");
const context_1 = require("./_lib/context");
async function main() {
    var _a, _b, _c;
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    let aiAccountEmailSuffix;
    let aiAccountEmailDomainAvailable = true;
    try {
        aiAccountEmailSuffix = (0, ai_account_email_domain_1.getAiAccountEmailSuffix)(await (0, ai_account_email_domain_1.getAvailableAiAccountEmailDomain)());
    }
    catch (_d) {
        aiAccountEmailDomainAvailable = false;
    }
    if (!user) {
        return (0, utils_1.ok)({
            userInfo: {},
            membership: { status: 'none', openStatusLabel: '立即开通' },
            deliverySummary: {
                hasDeliveryInfo: false,
            },
            subscribeMsgAuth: false,
        });
    }
    const membership = (_b = (_a = (await (0, db_1.getMembershipByUserId)(user._id, constants_1.DEFAULT_PRODUCT_CODE))) !== null && _a !== void 0 ? _a : (await (0, db_1.listMembershipsByUserId)(user._id)).find((item) => item.status === 'active' || item.status === 'opening')) !== null && _b !== void 0 ? _b : null;
    const delivery = await (0, db_1.getDeliveryByUserId)(user._id);
    const aiAccountRegistered = Boolean(user.aiAccountRegistered || user.aiAccountEmail);
    return (0, utils_1.ok)({
        userInfo: {
            mobile: (0, utils_1.maskMobile)(user.mobile),
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            inviteCode: user.inviteCode,
            pointsBalance: (_c = user.pointsBalance) !== null && _c !== void 0 ? _c : 0,
            aiAccount: {
                registered: aiAccountRegistered,
                email: user.aiAccountEmail,
                emailDomain: aiAccountEmailSuffix,
                emailDomainAvailable: aiAccountEmailDomainAvailable,
            },
        },
        membership: (0, utils_1.normalizeMembership)(membership),
        deliverySummary: delivery
            ? {
                hasDeliveryInfo: true,
                emailAccount: delivery.emailAccount,
                chatgptAccount: delivery.chatgptAccount,
                expireAt: delivery.expireAt,
                expireTag: delivery.expireAt ? (0, utils_1.calcExpireTag)(delivery.expireAt) : delivery.expireTag,
                remainDays: delivery.expireAt ? (0, utils_1.calcRemainDays)(delivery.expireAt) : undefined,
            }
            : {
                hasDeliveryInfo: false,
            },
        subscribeMsgAuth: user.subscribeMsgAuth,
    });
}
