import { collection, getUserByInviteCode, getUserByOpenId } from '../shared/db';
import type { UserRecord } from '../shared/types';
import { ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

interface Event {
  nickname?: string;
  avatarUrl?: string;
  inviteCode?: string;
  source?: string;
}

function createInviteCode(openid: string): string {
  return `U${openid.slice(-6).toUpperCase()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0')}`;
}

async function bindInviteRelation(
  currentUser: UserRecord & { _id: string },
  event: Event,
  now: number,
): Promise<string | undefined> {
  const inviteCode = event.inviteCode?.trim();

  if (currentUser.inviterUserId) {
    const existingRelation = await collection('inviteRelations')
      .where({ inviteeUserId: currentUser._id })
      .limit(1)
      .get();
    if (existingRelation.data[0]) {
      console.info('invite.bind.skipped', {
        reason: 'already_bound',
        userId: currentUser._id,
        inviteCode,
        inviterUserId: currentUser.inviterUserId,
      });
      return currentUser.inviterUserId;
    }

    const inviter = await collection('users').doc(currentUser.inviterUserId).get();
    const inviterUser = inviter.data as (UserRecord & { _id: string }) | undefined;
    await collection('inviteRelations').add({
      data: {
        inviterUserId: currentUser.inviterUserId,
        inviteeUserId: currentUser._id,
        inviteCode: inviteCode || inviterUser?.inviteCode || '',
        source: event.source ?? 'backfill',
        status: 'active',
        createdAt: currentUser.createdAt ?? now,
        updatedAt: now,
      },
    });

    console.info('invite.bind.backfilled', {
      inviterUserId: currentUser.inviterUserId,
      inviteeUserId: currentUser._id,
      inviteCode: inviteCode || inviterUser?.inviteCode || '',
      source: event.source ?? 'backfill',
    });
    return currentUser.inviterUserId;
  }

  if (!inviteCode) {
    console.info('invite.bind.skipped', {
      reason: 'missing_invite_code',
      userId: currentUser._id,
    });
    return undefined;
  }

  const inviter = await getUserByInviteCode(inviteCode);
  if (!inviter || inviter._id === currentUser._id) {
    console.info('invite.bind.skipped', {
      reason: !inviter ? 'inviter_not_found' : 'self_invite',
      userId: currentUser._id,
      inviteCode,
    });
    return currentUser.inviterUserId;
  }

  const existingRelation = await collection('inviteRelations')
    .where({ inviteeUserId: currentUser._id })
    .limit(1)
    .get();
  if (existingRelation.data[0]) {
    console.info('invite.bind.skipped', {
      reason: 'relation_exists',
      userId: currentUser._id,
      inviteCode,
    });
    return currentUser.inviterUserId;
  }

  await collection('inviteRelations').add({
    data: {
      inviterUserId: inviter._id,
      inviteeUserId: currentUser._id,
      inviteCode,
      source: event.source ?? 'share',
      status: 'active',
      createdAt: now,
      updatedAt: now,
    },
  });

  console.info('invite.bind.created', {
    inviterUserId: inviter._id,
    inviteeUserId: currentUser._id,
    inviteCode,
    source: event.source ?? 'share',
  });

  return inviter._id;
}

export async function main(event: Event = {}) {
  const now = Date.now();
  const { OPENID } = getWxContext();
  const existingUser = await getUserByOpenId(OPENID);

  if (existingUser) {
    const inviteCode = existingUser.inviteCode ?? createInviteCode(OPENID);
    const aiAccountRegistered = Boolean(existingUser.aiAccountRegistered || existingUser.aiAccountEmail);
    const inviterUserId = await bindInviteRelation(existingUser, event, now);
    await collection('users').doc(existingUser._id).update({
      data: {
        nickname: event.nickname ?? existingUser.nickname ?? '',
        avatarUrl: event.avatarUrl ?? existingUser.avatarUrl ?? '',
        inviteCode,
        inviterUserId,
        pointsBalance: existingUser.pointsBalance ?? 0,
        aiAccountRegistered,
        lastLoginAt: now,
        updatedAt: now,
      },
    });

    return ok({
      userId: existingUser._id,
      openid: OPENID,
      openId: OPENID,
      mobileBound: Boolean(existingUser.mobile),
      nickname: event.nickname ?? existingUser.nickname,
      avatarUrl: event.avatarUrl ?? existingUser.avatarUrl,
      inviteCode,
      inviterUserId,
      pointsBalance: existingUser.pointsBalance ?? 0,
      aiAccountRegistered,
    });
  }

  const user: UserRecord = {
    openid: OPENID,
    mobile: '',
    nickname: event.nickname,
    avatarUrl: event.avatarUrl,
    inviteCode: createInviteCode(OPENID),
    pointsBalance: 0,
    aiAccountRegistered: false,
    status: 'active',
    subscribeMsgAuth: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  const result = await collection('users').add({ data: user });
  const createdUser = { ...user, _id: result._id };
  const inviterUserId = await bindInviteRelation(createdUser, event, now);
  if (inviterUserId) {
    await collection('users').doc(result._id).update({
      data: {
        inviterUserId,
        updatedAt: now,
      },
    });
  }

  return ok({
    userId: result._id,
    openid: OPENID,
    openId: OPENID,
    mobileBound: false,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    inviteCode: user.inviteCode,
    inviterUserId,
    pointsBalance: user.pointsBalance,
    aiAccountRegistered: user.aiAccountRegistered,
  });
}
