"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const constants_1 = require("./shared/constants");
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
const points_config_1 = require("./shared/points-config");
const DAY_MS = 24 * 60 * 60 * 1000;
function buildMembershipFromOrder(order) {
    var _a;
    if (order.payStatus !== 'paid' || order.fulfillmentStatus !== 'fulfilled') {
        return null;
    }
    const startAt = (_a = order.fulfilledAt) !== null && _a !== void 0 ? _a : order.paidAt;
    if (!startAt || !order.durationDays) {
        return null;
    }
    const endAt = startAt + order.durationDays * DAY_MS;
    return {
        userId: order.userId,
        productCode: order.productCode,
        productName: order.productName,
        planCode: order.planCode,
        planName: order.planName,
        status: 'active',
        startAt,
        endAt,
        remainDays: (0, utils_1.calcRemainDays)(endAt),
        autoRenewStatus: 'off',
        createdAt: startAt,
        updatedAt: order.updatedAt,
    };
}
async function main() {
    var _a, _b, _c;
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    const pointsConfig = await (0, points_config_1.getPointsConfig)();
    if (!user) {
        return (0, utils_1.ok)({
            userInfo: {},
            membership: { status: 'none', openStatusLabel: '立即开通' },
            activeServices: [],
            deliverySummary: {
                hasDeliveryInfo: false,
            },
            subscribeMsgAuth: false,
            pointsConfig: {
                pointsPerYuan: pointsConfig.pointsPerYuan,
                inviteBaseRewardPoints: pointsConfig.inviteBaseRewardPoints,
            },
        });
    }
    const now = Date.now();
    const [memberships, orders] = await Promise.all([
        (0, db_1.listMembershipsByUserId)(user._id),
        (0, db_1.listOrdersByUserId)(user._id),
    ]);
    const activeMembershipProductCodes = new Set(memberships
        .filter((item) => item.status === 'active' && item.endAt > now)
        .map((item) => item.productCode));
    const orderDerivedMemberships = orders
        .map(buildMembershipFromOrder)
        .filter((item) => Boolean(item))
        .filter((item) => item.endAt > now && !activeMembershipProductCodes.has(item.productCode));
    const effectiveMemberships = [...memberships, ...orderDerivedMemberships];
    const isVisibleMembership = (item) => (item.status === 'opening'
        || (item.status === 'active' && item.endAt > now));
    const defaultMembership = effectiveMemberships.find((item) => item.productCode === constants_1.DEFAULT_PRODUCT_CODE && isVisibleMembership(item));
    const membership = (_a = defaultMembership !== null && defaultMembership !== void 0 ? defaultMembership : effectiveMemberships.find(isVisibleMembership)) !== null && _a !== void 0 ? _a : null;
    const activeServices = effectiveMemberships
        .filter((item) => item.status === 'active' && item.endAt > now)
        .sort((left, right) => right.endAt - left.endAt)
        .map(utils_1.normalizeMembership);
    const delivery = await (0, db_1.getDeliveryByUserId)(user._id);
    const aiAccountRegistered = Boolean(user.aiAccountRegistered || user.aiAccountEmail);
    return (0, utils_1.ok)({
        userInfo: {
            mobile: (0, utils_1.maskMobile)(user.mobile),
            nickname: user.nickname,
            avatarUrl: user.avatarUrl,
            inviteCode: user.inviteCode,
            pointsBalance: (_b = user.pointsBalance) !== null && _b !== void 0 ? _b : 0,
            aiToolPointsBalance: (_c = user.aiToolPointsBalance) !== null && _c !== void 0 ? _c : 0,
            aiAccount: {
                registered: aiAccountRegistered,
                email: user.aiAccountEmail,
            },
        },
        pointsConfig: {
            pointsPerYuan: pointsConfig.pointsPerYuan,
            inviteBaseRewardPoints: pointsConfig.inviteBaseRewardPoints,
        },
        membership: (0, utils_1.normalizeMembership)(membership),
        activeServices,
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
