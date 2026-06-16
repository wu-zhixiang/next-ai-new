import { collection, getUserByOpenId, listMembershipsByUserId, listOrdersByUserId } from '../shared/db';
import { getWxContext } from '../_lib/context';
import { ok } from '../shared/utils';
import type { MemberPlanRecord, OrderRecord } from '../shared/types';
import { DEFAULT_PRODUCT_CODE } from '../shared/constants';

interface Event {
  productCode?: string;
}

function normalizePurchasedProductCode(record: { productCode?: string }): string {
  return record.productCode || DEFAULT_PRODUCT_CODE;
}

function isFirstBuyPlan(plan: Pick<MemberPlanRecord, 'isFirstBuy'>): boolean {
  return normalizeBooleanFlag(plan.isFirstBuy);
}

function normalizeBooleanFlag(value: unknown): boolean {
  if (value === true || value === 1) {
    return true;
  }
  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true' || value.trim() === '1';
  }
  return false;
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
      purchasedProductCodes.add(normalizePurchasedProductCode(membership));
    });
    orders
      .filter((order: OrderRecord) => order.payStatus === 'paid')
      .forEach((order) => {
        purchasedProductCodes.add(normalizePurchasedProductCode(order));
      });
  }

  const productHasFirstBuyPlan = new Set(
    rawPlans
      .filter(isFirstBuyPlan)
      .map((plan) => plan.productCode),
  );

  const visiblePlans = rawPlans.filter((plan) => {
    const firstBuyPlan = isFirstBuyPlan(plan);
    const isFirstBuyer = !purchasedProductCodes.has(plan.productCode);
    if (isFirstBuyer && productHasFirstBuyPlan.has(plan.productCode)) {
      return firstBuyPlan;
    }
    if (!isFirstBuyer) {
      return !firstBuyPlan;
    }
    return true;
  });

  const plans = visiblePlans.map((item) => {
    const plan = item as MemberPlanRecord;
    return {
      pid: plan.pid,
      productCode: plan.productCode,
      productName: plan.productName,
      planCode: plan.planCode,
      planName: plan.planName,
      isFirstBuy: isFirstBuyPlan(plan),
      price: plan.price,
      durationDays: plan.durationDays,
      description: plan.description,
    };
  });

  return ok({ plans });
}
