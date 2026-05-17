import { DEFAULT_PRODUCT_CODE } from '../shared/constants';
import { getDeliveryByUserId, getMembershipByUserId, getUserByOpenId, listMembershipsByUserId } from '../shared/db';
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
    (await listMembershipsByUserId(user._id)).find((item) => item.status === 'active') ??
    null;
  const delivery = await getDeliveryByUserId(user._id);

  return ok({
    userInfo: {
      mobile: maskMobile(user.mobile),
      nickname: user.nickname,
      avatarUrl: user.avatarUrl,
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
