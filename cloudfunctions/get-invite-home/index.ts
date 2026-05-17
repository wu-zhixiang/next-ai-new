import { _, collection, getUserByOpenId, listInviteRelationsByInviterId } from '../shared/db';
import type { PointsLedgerRecord, UserRecord } from '../shared/types';
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
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    throw new Error('用户未登录');
  }

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

  const ledgersResult = await collection('pointsLedger')
    .where({
      userId: user._id,
      type: 'invite_reward',
    })
    .get();
  const rewardLedgers = ledgersResult.data as PointsLedgerRecord[];
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

  const totalRewardPoints = rewardLedgers.reduce((total, ledger) => total + ledger.points, 0);

  return ok({
    inviteCode: user.inviteCode,
    inviteCount: invitees.length,
    pointsBalance: user.pointsBalance ?? 0,
    totalRewardPoints,
    invitees,
  });
}
