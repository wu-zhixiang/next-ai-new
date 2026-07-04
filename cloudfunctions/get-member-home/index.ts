import { DEFAULT_PRODUCT_CODE } from '../shared/constants';
import {
  getDeliveryByUserId,
  getUserByOpenId,
  listOrdersByUserId,
  listMembershipsByUserId,
} from '../shared/db';
import { calcExpireTag, calcRemainDays, maskMobile, normalizeMembership, ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';
import type { MembershipRecord, OrderRecord } from '../shared/types';

const DAY_MS = 24 * 60 * 60 * 1000;

function buildMembershipFromOrder(order: OrderRecord): MembershipRecord | null {
  if (order.payStatus !== 'paid' || order.fulfillmentStatus !== 'fulfilled') {
    return null;
  }
  const startAt = order.fulfilledAt ?? order.paidAt;
  if (!startAt || !order.durationDays) {
    return null;
  }
  const endAt = startAt + order.durationDays * DAY_MS;
  return {
    userId: order.userId,
    productCode: order.productCode,
    productName: order.productName,
    planCode: order.planCode,
    planName: order.planName,
    status: 'active',
    startAt,
    endAt,
    remainDays: calcRemainDays(endAt),
    autoRenewStatus: 'off',
    createdAt: startAt,
    updatedAt: order.updatedAt,
  };
}

export async function main() {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);

  if (!user) {
    return ok({
      userInfo: {},
      membership: { status: 'none' as const, openStatusLabel: '立即开通' as const },
      activeServices: [],
      deliverySummary: {
        hasDeliveryInfo: false,
      },
      subscribeMsgAuth: false,
    });
  }

  const now = Date.now();
  const [memberships, orders] = await Promise.all([
    listMembershipsByUserId(user._id),
    listOrdersByUserId(user._id),
  ]);
  const activeMembershipProductCodes = new Set(
    memberships
      .filter((item) => item.status === 'active' && item.endAt > now)
      .map((item) => item.productCode),
  );
  const orderDerivedMemberships = orders
    .map(buildMembershipFromOrder)
    .filter((item): item is MembershipRecord => Boolean(item))
    .filter((item) => item.endAt > now && !activeMembershipProductCodes.has(item.productCode));
  const effectiveMemberships = [...memberships, ...orderDerivedMemberships];
  const isVisibleMembership = (item: MembershipRecord): boolean => (
    item.status === 'opening'
    || (item.status === 'active' && item.endAt > now)
  );
  const defaultMembership = effectiveMemberships.find(
    (item) => item.productCode === DEFAULT_PRODUCT_CODE && isVisibleMembership(item),
  );
  const membership = defaultMembership ?? effectiveMemberships.find(isVisibleMembership) ?? null;
  const activeServices = effectiveMemberships
    .filter((item) => item.status === 'active' && item.endAt > now)
    .sort((left, right) => right.endAt - left.endAt)
    .map(normalizeMembership);
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
    activeServices,
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
