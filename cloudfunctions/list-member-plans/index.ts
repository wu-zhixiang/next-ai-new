import { collection, getUserByOpenId, listMembershipsByUserId, listOrdersByUserId } from '../shared/db';
import { getWxContext } from '../_lib/context';
import { ok } from '../shared/utils';
import type { MemberPlanRecord, OrderRecord } from '../shared/types';

interface Event {
  productCode?: string;
}

export async function main(event: Event = {}) {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  const query = event.productCode ? { status: 'on', productCode: event.productCode } : { status: 'on' };
  const result = await collection('memberPlans')
    .where(query)
    .orderBy('sort', 'asc')
    .get();
  const rawPlans = result.data as MemberPlanRecord[];

  const purchasedProductCodes = new Set<string>();
  if (user?._id) {
    const [memberships, orders] = await Promise.all([
      listMembershipsByUserId(user._id),
      listOrdersByUserId(user._id),
    ]);
    memberships.forEach((membership) => {
      if (membership.productCode) {
        purchasedProductCodes.add(membership.productCode);
      }
    });
    orders
      .filter((order: OrderRecord) => order.payStatus === 'paid')
      .forEach((order) => {
        if (order.productCode) {
          purchasedProductCodes.add(order.productCode);
        }
      });
  }

  const productHasFirstBuyPlan = new Set(
    rawPlans
      .filter((plan) => Boolean(plan.isFirstBuy || plan.isFirstBay))
      .map((plan) => plan.productCode),
  );

  const visiblePlans = rawPlans.filter((plan) => {
    const isFirstBuyPlan = Boolean(plan.isFirstBuy || plan.isFirstBay);
    const isFirstBuyer = !purchasedProductCodes.has(plan.productCode);
    if (isFirstBuyer && productHasFirstBuyPlan.has(plan.productCode)) {
      return isFirstBuyPlan;
    }
    if (!isFirstBuyer) {
      return !isFirstBuyPlan;
    }
    return true;
  });

  const plans = visiblePlans.map((item) => {
    const plan = item as MemberPlanRecord;
    return {
      productCode: plan.productCode,
      productName: plan.productName,
      planCode: plan.planCode,
      planName: plan.planName,
      isFirstBuy: Boolean(plan.isFirstBuy || plan.isFirstBay),
      isFirstBay: Boolean(plan.isFirstBay || plan.isFirstBuy),
      price: plan.price,
      durationDays: plan.durationDays,
      description: plan.description,
    };
  });

  return ok({ plans });
}
