"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.grantPendingInviteRewards = grantPendingInviteRewards;
const db_1 = require("./db");
const points_config_1 = require("./points-config");
function hasLegacyMilestoneLedger(ledger, inviteCount) {
    return !ledger.milestoneKey && ledger.description.includes(`累计邀请${inviteCount}人`);
}
async function grantPendingInviteRewards(inviterUserId, now = Date.now()) {
    const [config, relations] = await Promise.all([
        (0, points_config_1.getPointsConfig)(),
        (0, db_1.listInviteRelationsByInviterId)(inviterUserId),
    ]);
    const activeRelations = relations.filter((relation) => relation.status === 'active' && relation.inviteeUserId !== inviterUserId);
    if (activeRelations.length === 0) {
        return;
    }
    const ledgersResult = await (0, db_1.collection)('pointsLedger')
        .where({ userId: inviterUserId })
        .get();
    const ledgers = ledgersResult.data;
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
            pointsBalance: db_1._.inc(totalRewardPoints),
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
            relatedUserId: relation.inviteeUserId,
            type: 'invite_reward',
            direction: 'in',
            points: config.inviteBaseRewardPoints,
            balanceAfter: inviter === null || inviter === void 0 ? void 0 : inviter.pointsBalance,
            description: `邀请好友登录奖励${config.inviteBaseRewardPoints}积分`,
            createdAt: now,
        };
        await (0, db_1.collection)('pointsLedger').add({ data: ledger });
    }
    for (const milestone of pendingMilestones) {
        const ledger = {
            userId: inviterUserId,
            milestoneKey: (0, points_config_1.getMilestoneKey)(milestone),
            type: 'invite_milestone',
            direction: 'in',
            points: milestone.rewardPoints,
            balanceAfter: inviter === null || inviter === void 0 ? void 0 : inviter.pointsBalance,
            description: milestone.description || `累计邀请${milestone.inviteCount}人奖励${milestone.rewardPoints}积分`,
            createdAt: now,
        };
        await (0, db_1.collection)('pointsLedger').add({ data: ledger });
    }
    console.info('invite.reward.created', {
        inviterUserId,
        inviteCount: activeRelations.length,
        inviteeUserIds: pendingRelations.map((relation) => relation.inviteeUserId),
        milestoneKeys: pendingMilestones.map(points_config_1.getMilestoneKey),
        points: totalRewardPoints,
    });
}
