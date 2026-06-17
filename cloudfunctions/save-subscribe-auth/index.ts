import { _, collection, getUserByOpenId } from '../shared/db';
import { getWxContext } from '../_lib/context';
import { ok } from '../shared/utils';

interface Event {
  accepted: boolean;
  scene?: 'member' | 'news';
}

function normalizeAccepted(value: unknown): boolean | null {
  if (value === true || value === 'true' || value === 1) {
    return true;
  }
  if (value === false || value === 'false' || value === 0) {
    return false;
  }
  return null;
}

export async function main(event: Event = {} as Event) {
  const { OPENID } = getWxContext();
  const accepted = normalizeAccepted(event.accepted);
  console.info('subscribe-auth.save.request', {
    openid: OPENID,
    scene: event.scene || 'member',
    accepted,
  });

  if (!OPENID) {
    console.warn('subscribe-auth.save.openid-missing', {
      scene: event.scene || 'member',
      accepted,
    });
    throw new Error('未获取到微信登录态，请重新进入小程序后重试');
  }
  if (accepted === null) {
    throw new Error('订阅状态参数不正确');
  }

  const user = await getUserByOpenId(OPENID);
  if (!user) {
    console.warn('subscribe-auth.save.user-missing', {
      openid: OPENID,
      scene: event.scene || 'member',
    });
    throw new Error('用户未登录');
  }

  const now = Date.now();
  const data = event.scene === 'news'
    ? {
      newsSubscribeMsgAuth: accepted,
      newsSubscribeMsgAuthAt: accepted ? now : undefined,
      newsSubscribeMsgQuota: accepted ? _.inc(1) : 0,
      updatedAt: now,
    }
    : {
      subscribeMsgAuth: accepted,
      subscribeMsgAuthAt: accepted ? now : undefined,
      updatedAt: now,
    };

  await collection('users').doc(user._id).update({
    data,
  });

  console.info('subscribe-auth.save.success', {
    openid: OPENID,
    userId: user._id,
    scene: event.scene || 'member',
    accepted,
  });

  return ok({ success: true });
}
