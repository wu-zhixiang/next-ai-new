"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const points_config_1 = require("./shared/points-config");
const points_rewards_1 = require("./shared/points-rewards");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
async function main() {
    var _a, _b, _c;
    const { OPENID } = (0, context_1.getWxContext)();
    const rawUser = await (0, db_1.getUserByOpenId)(OPENID);
    if (!rawUser) {
        throw new Error('用户未登录');
    }
    const user = await (0, points_rewards_1.migrateLegacyPointsBalanceToAiToolPoints)(rawUser);
    await (0, points_rewards_1.grantPendingInviteRewards)(user._id);
    const refreshedUser = await (0, db_1.getUserByOpenId)(OPENID);
    const currentUser = refreshedUser !== null && refreshedUser !== void 0 ? refreshedUser : user;
    const relations = await (0, db_1.listInviteRelationsByInviterId)(user._id);
    const inviteeIds = relations.map((relation) => relation.inviteeUserId);
    const usersById = new Map();
    if (inviteeIds.length > 0) {
        const usersResult = await (0, db_1.collection)('users')
            .where({
            _id: db_1._.in(inviteeIds),
        })
            .get();
        for (const item of usersResult.data) {
            usersById.set(item._id, item);
        }
    }
    const [legacyLedgersResult, aiToolLedgersResult, pointsConfig] = await Promise.all([
        (0, db_1.collection)('pointsLedger').where({ userId: user._id }).get(),
        (0, db_1.collection)('aiToolPointsLedger').where({ userId: user._id }).get(),
        (0, points_config_1.getPointsConfig)(),
    ]);
    const ledgers = [
        ...legacyLedgersResult.data,
        ...aiToolLedgersResult.data,
    ];
    const rewardLedgers = ledgers.filter((ledger) => ledger.type === 'invite_reward');
    const milestoneLedgers = ledgers.filter((ledger) => ledger.type === 'invite_milestone');
    const rewardByInvitee = new Map();
    for (const ledger of rewardLedgers) {
        const relatedUserId = ledger.relatedUserId;
        if (!relatedUserId)
            continue;
        rewardByInvitee.set(relatedUserId, ((_a = rewardByInvitee.get(relatedUserId)) !== null && _a !== void 0 ? _a : 0) + ledger.points);
    }
    const invitees = relations.map((relation) => {
        var _a;
        const invitee = usersById.get(relation.inviteeUserId);
        return {
            userId: relation.inviteeUserId,
            nickname: (invitee === null || invitee === void 0 ? void 0 : invitee.nickname) || `用户${relation.inviteeUserId.slice(-4)}`,
            avatarUrl: invitee === null || invitee === void 0 ? void 0 : invitee.avatarUrl,
            joinedAt: relation.createdAt,
            status: '已加入',
            rewardPoints: (_a = rewardByInvitee.get(relation.inviteeUserId)) !== null && _a !== void 0 ? _a : 0,
        };
    });
    const totalRewardPoints = [...rewardLedgers, ...milestoneLedgers].reduce((total, ledger) => total + ledger.points, 0);
    return (0, utils_1.ok)({
        inviteCode: currentUser.inviteCode,
        inviteCount: invitees.length,
        pointsBalance: (_b = currentUser.aiToolPointsBalance) !== null && _b !== void 0 ? _b : 0,
        aiToolPointsBalance: (_c = currentUser.aiToolPointsBalance) !== null && _c !== void 0 ? _c : 0,
        totalRewardPoints,
        invitees,
        pointsConfig: {
            pointsPerYuan: pointsConfig.pointsPerYuan,
            inviteBaseRewardPoints: pointsConfig.inviteBaseRewardPoints,
            inviteMilestones: pointsConfig.inviteMilestones.filter((milestone) => milestone.enabled),
        },
    });
}
