import { _, collection, getUserByOpenId } from '../shared/db';
import { getWxContext } from '../_lib/context';
import { ok } from '../shared/utils';

interface Event {
  accepted: boolean;
  scene?: 'member' | 'news';
}

export async function main(event: Event) {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    throw new Error('用户未登录');
  }

  const now = Date.now();
  const data = event.scene === 'news'
    ? {
      newsSubscribeMsgAuth: event.accepted,
      newsSubscribeMsgAuthAt: event.accepted ? now : undefined,
      newsSubscribeMsgQuota: event.accepted ? _.inc(1) : 0,
      updatedAt: now,
    }
    : {
      subscribeMsgAuth: event.accepted,
      subscribeMsgAuthAt: event.accepted ? now : undefined,
      updatedAt: now,
    };

  await collection('users').doc(user._id).update({
    data,
  });

  return ok({ success: true });
}
