import { _, collection, getUserById, listInviteRelationsByInviterId } from './db';
import { getMilestoneKey, getPointsConfig } from './points-config';
import type { PointsLedgerRecord } from './types';

function hasLegacyMilestoneLedger(ledger: PointsLedgerRecord, inviteCount: number): boolean {
  return !ledger.milestoneKey && ledger.description.includes(`累计邀请${inviteCount}人`);
}

export async function grantPendingInviteRewards(inviterUserId: string, now = Date.now()): Promise<void> {
  const [config, relations] = await Promise.all([
    getPointsConfig(),
    listInviteRelationsByInviterId(inviterUserId),
  ]);
  const activeRelations = relations.filter((relation) => relation.status === 'active' && relation.inviteeUserId !== inviterUserId);
  if (activeRelations.length === 0) {
    return;
  }

  const ledgersResult = await collection('pointsLedger')
    .where({ userId: inviterUserId })
    .get();
  const ledgers = ledgersResult.data as PointsLedgerRecord[];
  const inviteRewardLedgers = ledgers.filter((ledger) => ledger.type === 'invite_reward');
  const milestoneLedgers = ledgers.filter((ledger) => ledger.type === 'invite_milestone');
  const rewardedInviteeIds = new Set(
    inviteRewardLedgers
      .map((ledger) => ledger.relatedUserId)
      .filter((relatedUserId): relatedUserId is string => Boolean(relatedUserId)),
  );
  const pendingRelations = activeRelations.filter((relation) => !rewardedInviteeIds.has(relation.inviteeUserId));
  const pendingMilestones = config.inviteMilestones
    .filter((milestone) => milestone.enabled)
    .filter((milestone) => activeRelations.length >= milestone.inviteCount)
    .filter((milestone) => {
      const key = getMilestoneKey(milestone);
      return !milestoneLedgers.some((ledger) => ledger.milestoneKey === key || hasLegacyMilestoneLedger(ledger, milestone.inviteCount));
    });

  const baseRewardPoints = pendingRelations.length * config.inviteBaseRewardPoints;
  const milestoneRewardPoints = pendingMilestones.reduce((total, milestone) => total + milestone.rewardPoints, 0);
  const totalRewardPoints = baseRewardPoints + milestoneRewardPoints;
  if (totalRewardPoints <= 0) {
    return;
  }

  await collection('users').doc(inviterUserId).update({
    data: {
      pointsBalance: _.inc(totalRewardPoints),
      updatedAt: now,
    },
  });

  const inviter = await getUserById(inviterUserId);
  for (const relation of pendingRelations) {
    if (config.inviteBaseRewardPoints <= 0) {
      continue;
    }
    const ledger: PointsLedgerRecord = {
      userId: inviterUserId,
      relatedUserId: relation.inviteeUserId,
      type: 'invite_reward',
      direction: 'in',
      points: config.inviteBaseRewardPoints,
      balanceAfter: inviter?.pointsBalance,
      description: `邀请好友登录奖励${config.inviteBaseRewardPoints}积分`,
      createdAt: now,
    };
    await collection('pointsLedger').add({ data: ledger });
  }

  for (const milestone of pendingMilestones) {
    const ledger: PointsLedgerRecord = {
      userId: inviterUserId,
      milestoneKey: getMilestoneKey(milestone),
      type: 'invite_milestone',
      direction: 'in',
      points: milestone.rewardPoints,
      balanceAfter: inviter?.pointsBalance,
      description: milestone.description || `累计邀请${milestone.inviteCount}人奖励${milestone.rewardPoints}积分`,
      createdAt: now,
    };
    await collection('pointsLedger').add({ data: ledger });
  }

  console.info('invite.reward.created', {
    inviterUserId,
    inviteCount: activeRelations.length,
    inviteeUserIds: pendingRelations.map((relation) => relation.inviteeUserId),
    milestoneKeys: pendingMilestones.map(getMilestoneKey),
    points: totalRewardPoints,
  });
}
