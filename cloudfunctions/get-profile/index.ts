import { DEFAULT_PRODUCT_CODE } from '../shared/constants';
import { getMembershipByUserId, getUserByOpenId, listMembershipsByUserId } from '../shared/db';
import { getWxContext } from '../_lib/context';
import { maskMobile, ok } from '../shared/utils';

export async function main() {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);

  if (!user) {
    return ok({
      mobile: '',
      mobileBound: false,
      nickname: '',
      avatarUrl: '',
      membershipStatus: 'none' as const,
      subscribeMsgAuth: false,
    });
  }

  const membership =
    (await getMembershipByUserId(user._id, DEFAULT_PRODUCT_CODE)) ??
    (await listMembershipsByUserId(user._id)).find((item) => item.status === 'active') ??
    null;
  return ok({
    mobile: maskMobile(user.mobile),
    mobileBound: Boolean(user.mobile),
    nickname: user.nickname,
    avatarUrl: user.avatarUrl,
    membershipStatus: membership?.status ?? 'none',
    membershipProductCode: membership?.productCode,
    membershipProductName: membership?.productName,
    subscribeMsgAuth: user.subscribeMsgAuth,
  });
}
