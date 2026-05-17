import { collection, getUserByOpenId } from '../shared/db';
import { getWxContext } from '../_lib/context';
import { ok } from '../shared/utils';

interface Event {
  accepted: boolean;
}

export async function main(event: Event) {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    throw new Error('用户未登录');
  }

  await collection('users').doc(user._id).update({
    data: {
      subscribeMsgAuth: event.accepted,
      subscribeMsgAuthAt: event.accepted ? Date.now() : undefined,
      updatedAt: Date.now(),
    },
  });

  return ok({ success: true });
}
