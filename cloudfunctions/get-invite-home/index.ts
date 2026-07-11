import { _, collection, getUserByOpenId, listInviteRelationsByInviterId } from '../shared/db';
import type { AiToolPointsLedgerRecord, PointsLedgerRecord, UserRecord } from '../shared/types';
import { getPointsConfig } from '../shared/points-config';
import { grantPendingInviteRewards, migrateLegacyPointsBalanceToAiToolPoints } from '../shared/points-rewards';
import { ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

interface InviteeView {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  joinedAt: number;
  status: '已加入';
  rewardPoints: number;
}

export async function main() {
  const { OPENID } = getWxContext();
  const rawUser = await getUserByOpenId(OPENID);
  if (!rawUser) {
    throw new Error('用户未登录');
  }
  const user = await migrateLegacyPointsBalanceToAiToolPoints(rawUser);

  await grantPendingInviteRewards(user._id);
  const refreshedUser = await getUserByOpenId(OPENID);
  const currentUser = refreshedUser ?? user;
  const relations = await listInviteRelationsByInviterId(user._id);
  const inviteeIds = relations.map((relation) => relation.inviteeUserId);
  const usersById = new Map<string, UserRecord & { _id: string }>();

  if (inviteeIds.length > 0) {
    const usersResult = await collection('users')
      .where({
        _id: _.in(inviteeIds),
      })
      .get();
    for (const item of usersResult.data as Array<UserRecord & { _id: string }>) {
      usersById.set(item._id, item);
    }
  }

  const [legacyLedgersResult, aiToolLedgersResult, pointsConfig] = await Promise.all([
    collection('pointsLedger').where({ userId: user._id }).get(),
    collection('aiToolPointsLedger').where({ userId: user._id }).get(),
    getPointsConfig(),
  ]);
  const ledgers = [
    ...(legacyLedgersResult.data as PointsLedgerRecord[]),
    ...(aiToolLedgersResult.data as AiToolPointsLedgerRecord[]),
  ];
  const rewardLedgers = ledgers.filter((ledger) => ledger.type === 'invite_reward');
  const milestoneLedgers = ledgers.filter((ledger) => ledger.type === 'invite_milestone');
  const rewardByInvitee = new Map<string, number>();
  for (const ledger of rewardLedgers) {
    const relatedUserId = ledger.relatedUserId;
    if (!relatedUserId) continue;
    rewardByInvitee.set(relatedUserId, (rewardByInvitee.get(relatedUserId) ?? 0) + ledger.points);
  }

  const invitees: InviteeView[] = relations.map((relation) => {
    const invitee = usersById.get(relation.inviteeUserId);
    return {
      userId: relation.inviteeUserId,
      nickname: invitee?.nickname || `用户${relation.inviteeUserId.slice(-4)}`,
      avatarUrl: invitee?.avatarUrl,
      joinedAt: relation.createdAt,
      status: '已加入',
      rewardPoints: rewardByInvitee.get(relation.inviteeUserId) ?? 0,
    };
  });

  const totalRewardPoints = [...rewardLedgers, ...milestoneLedgers].reduce((total, ledger) => total + ledger.points, 0);

  return ok({
    inviteCode: currentUser.inviteCode,
    inviteCount: invitees.length,
    pointsBalance: currentUser.aiToolPointsBalance ?? 0,
    aiToolPointsBalance: currentUser.aiToolPointsBalance ?? 0,
    totalRewardPoints,
    invitees,
    pointsConfig: {
      pointsPerYuan: pointsConfig.pointsPerYuan,
      inviteBaseRewardPoints: pointsConfig.inviteBaseRewardPoints,
      inviteMilestones: pointsConfig.inviteMilestones.filter((milestone) => milestone.enabled),
    },
  });
}
