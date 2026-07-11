"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrateLegacyPointsBalanceToAiToolPoints = migrateLegacyPointsBalanceToAiToolPoints;
exports.grantPendingInviteRewards = grantPendingInviteRewards;
const db_1 = require("./db");
const points_config_1 = require("./points-config");
function hasLegacyMilestoneLedger(ledger, inviteCount) {
    return !ledger.milestoneKey && ledger.description.includes(`累计邀请${inviteCount}人`);
}
function normalizeNonNegativeInteger(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}
async function migrateLegacyPointsBalanceToAiToolPoints(user, now = Date.now()) {
    var _a;
    const legacyPoints = normalizeNonNegativeInteger(user.pointsBalance);
    if (legacyPoints <= 0) {
        return user;
    }
    await (0, db_1.ensureCollection)('aiToolPointsLedger');
    await (0, db_1.collection)('users').doc(user._id).update({
        data: {
            pointsBalance: db_1._.inc(-legacyPoints),
            aiToolPointsBalance: db_1._.inc(legacyPoints),
            updatedAt: now,
        },
    });
    const refreshedUser = await (0, db_1.getUserById)(user._id);
    const ledger = {
        userId: user._id,
        openid: user.openid,
        type: 'legacy_points_migration',
        direction: 'in',
        points: legacyPoints,
        balanceAfter: refreshedUser === null || refreshedUser === void 0 ? void 0 : refreshedUser.aiToolPointsBalance,
        description: `历史邀请积分转入AI工具积分${legacyPoints}积分`,
        createdAt: now,
    };
    await (0, db_1.collection)('aiToolPointsLedger').add({ data: ledger });
    return {
        ...user,
        pointsBalance: 0,
        aiToolPointsBalance: (_a = refreshedUser === null || refreshedUser === void 0 ? void 0 : refreshedUser.aiToolPointsBalance) !== null && _a !== void 0 ? _a : normalizeNonNegativeInteger(user.aiToolPointsBalance) + legacyPoints,
    };
}
async function grantPendingInviteRewards(inviterUserId, now = Date.now()) {
    await (0, db_1.ensureCollection)('aiToolPointsLedger');
    const [config, relations] = await Promise.all([
        (0, points_config_1.getPointsConfig)(),
        (0, db_1.listInviteRelationsByInviterId)(inviterUserId),
    ]);
    const activeRelations = relations.filter((relation) => relation.status === 'active' && relation.inviteeUserId !== inviterUserId);
    if (activeRelations.length === 0) {
        return;
    }
    const [legacyLedgersResult, aiToolLedgersResult] = await Promise.all([
        (0, db_1.collection)('pointsLedger')
            .where({ userId: inviterUserId })
            .get(),
        (0, db_1.collection)('aiToolPointsLedger')
            .where({ userId: inviterUserId })
            .get(),
    ]);
    const ledgers = [
        ...legacyLedgersResult.data,
        ...aiToolLedgersResult.data,
    ];
    const inviteRewardLedgers = ledgers.filter((ledger) => ledger.type === 'invite_reward');
    const milestoneLedgers = ledgers.filter((ledger) => ledger.type === 'invite_milestone');
    const rewardedInviteeIds = new Set(inviteRewardLedgers
        .map((ledger) => ledger.relatedUserId)
        .filter((relatedUserId) => Boolean(relatedUserId)));
    const pendingRelations = activeRelations.filter((relation) => !rewardedInviteeIds.has(relation.inviteeUserId));
    const pendingMilestones = config.inviteMilestones
        .filter((milestone) => milestone.enabled)
        .filter((milestone) => activeRelations.length >= milestone.inviteCount)
        .filter((milestone) => {
        const key = (0, points_config_1.getMilestoneKey)(milestone);
        return !milestoneLedgers.some((ledger) => ledger.milestoneKey === key || hasLegacyMilestoneLedger(ledger, milestone.inviteCount));
    });
    const baseRewardPoints = pendingRelations.length * config.inviteBaseRewardPoints;
    const milestoneRewardPoints = pendingMilestones.reduce((total, milestone) => total + milestone.rewardPoints, 0);
    const totalRewardPoints = baseRewardPoints + milestoneRewardPoints;
    if (totalRewardPoints <= 0) {
        return;
    }
    await (0, db_1.collection)('users').doc(inviterUserId).update({
        data: {
            aiToolPointsBalance: db_1._.inc(totalRewardPoints),
            updatedAt: now,
        },
    });
    const inviter = await (0, db_1.getUserById)(inviterUserId);
    for (const relation of pendingRelations) {
        if (config.inviteBaseRewardPoints <= 0) {
            continue;
        }
        const ledger = {
            userId: inviterUserId,
            openid: inviter === null || inviter === void 0 ? void 0 : inviter.openid,
            relatedUserId: relation.inviteeUserId,
            type: 'invite_reward',
            direction: 'in',
            points: config.inviteBaseRewardPoints,
            balanceAfter: inviter === null || inviter === void 0 ? void 0 : inviter.aiToolPointsBalance,
            description: `邀请好友登录奖励${config.inviteBaseRewardPoints}积分`,
            createdAt: now,
        };
        await (0, db_1.collection)('aiToolPointsLedger').add({ data: ledger });
    }
    for (const milestone of pendingMilestones) {
        const ledger = {
            userId: inviterUserId,
            openid: inviter === null || inviter === void 0 ? void 0 : inviter.openid,
            milestoneKey: (0, points_config_1.getMilestoneKey)(milestone),
            type: 'invite_milestone',
            direction: 'in',
            points: milestone.rewardPoints,
            balanceAfter: inviter === null || inviter === void 0 ? void 0 : inviter.aiToolPointsBalance,
            description: milestone.description || `累计邀请${milestone.inviteCount}人奖励${milestone.rewardPoints}积分`,
            createdAt: now,
        };
        await (0, db_1.collection)('aiToolPointsLedger').add({ data: ledger });
    }
    console.info('invite.reward.created', {
        inviterUserId,
        inviteCount: activeRelations.length,
        inviteeUserIds: pendingRelations.map((relation) => relation.inviteeUserId),
        milestoneKeys: pendingMilestones.map(points_config_1.getMilestoneKey),
        points: totalRewardPoints,
    });
}
