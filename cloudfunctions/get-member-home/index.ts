import { DEFAULT_PRODUCT_CODE } from '../shared/constants';
import {
  getDeliveryByUserId,
  getMembershipByUserId,
  getUserByOpenId,
  listMembershipsByUserId,
} from '../shared/db';
import { calcExpireTag, calcRemainDays, maskMobile, normalizeMembership, ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

export async function main() {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);

  if (!user) {
    return ok({
      userInfo: {},
      membership: { status: 'none' as const, openStatusLabel: '立即开通' as const },
      deliverySummary: {
        hasDeliveryInfo: false,
      },
      subscribeMsgAuth: false,
    });
  }

  const membership =
    (await getMembershipByUserId(user._id, DEFAULT_PRODUCT_CODE)) ??
    (await listMembershipsByUserId(user._id)).find((item) => item.status === 'active' || item.status === 'opening') ??
    null;
  const delivery = await getDeliveryByUserId(user._id);
  const aiAccountRegistered = Boolean(user.aiAccountRegistered || user.aiAccountEmail);

  return ok({
    userInfo: {
      mobile: maskMobile(user.mobile),
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
      inviteCode: user.inviteCode,
      pointsBalance: user.pointsBalance ?? 0,
      aiAccount: {
        registered: aiAccountRegistered,
        email: user.aiAccountEmail,
      },
    },
    membership: normalizeMembership(membership),
    deliverySummary: delivery
      ? {
          hasDeliveryInfo: true,
          emailAccount: delivery.emailAccount,
          chatgptAccount: delivery.chatgptAccount,
          expireAt: delivery.expireAt,
          expireTag: delivery.expireAt ? calcExpireTag(delivery.expireAt) : delivery.expireTag,
          remainDays: delivery.expireAt ? calcRemainDays(delivery.expireAt) : undefined,
        }
      : {
          hasDeliveryInfo: false,
        },
    subscribeMsgAuth: user.subscribeMsgAuth,
  });
}
