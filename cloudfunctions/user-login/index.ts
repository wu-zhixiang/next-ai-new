import { collection, getUserByOpenId } from '../shared/db';
import type { UserRecord } from '../shared/types';
import { ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

interface Event {
  nickname?: string;
  avatarUrl?: string;
}

export async function main(event: Event) {
  const now = Date.now();
  const { OPENID } = getWxContext();
  const existingUser = await getUserByOpenId(OPENID);

  if (existingUser) {
    await collection('users').doc(existingUser._id).update({
      data: {
        nickname: event.nickname ?? existingUser.nickname ?? '',
        avatarUrl: event.avatarUrl ?? existingUser.avatarUrl ?? '',
        lastLoginAt: now,
        updatedAt: now,
      },
    });

    return ok({
      userId: existingUser._id,
      mobileBound: Boolean(existingUser.mobile),
      nickname: event.nickname ?? existingUser.nickname,
      avatarUrl: event.avatarUrl ?? existingUser.avatarUrl,
    });
  }

  const user: UserRecord = {
    openid: OPENID,
    mobile: '',
    nickname: event.nickname,
    avatarUrl: event.avatarUrl,
    status: 'active',
    subscribeMsgAuth: false,
    createdAt: now,
    updatedAt: now,
    lastLoginAt: now,
  };

  const result = await collection('users').add({ data: user });
  return ok({
    userId: result._id,
    mobileBound: false,
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
  });
}
