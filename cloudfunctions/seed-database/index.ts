import { collection } from '../shared/db';
import type { MemberPlanRecord } from '../shared/types';
import { DEFAULT_PRODUCT_CODE, DEFAULT_PRODUCT_NAME } from '../shared/constants';
import { ok } from '../shared/utils';

interface Event {
  dryRun?: boolean;
}

const PLAN_SEED: MemberPlanRecord[] = [
  {
    productCode: DEFAULT_PRODUCT_CODE,
    productName: DEFAULT_PRODUCT_NAME,
    planCode: 'annual',
    planName: '年度会员',
    price: 0.01,
    durationDays: 365,
    autoRenewEnabled: false,
    status: 'on',
    sort: 1,
    description: '年度主力套餐，适合长期使用场景。',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
  {
    productCode: DEFAULT_PRODUCT_CODE,
    productName: DEFAULT_PRODUCT_NAME,
    planCode: 'quarterly',
    planName: '季度会员',
    price: 0.01,
    durationDays: 90,
    autoRenewEnabled: false,
    status: 'on',
    sort: 2,
    description: '季度会员套餐，适合阶段性体验。',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
  {
    productCode: DEFAULT_PRODUCT_CODE,
    productName: DEFAULT_PRODUCT_NAME,
    planCode: 'monthly',
    planName: '月度会员',
    price: 0.01,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 3,
    description: '月度短周期套餐，适合低门槛试用。',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
];

export async function main(event: Event = {}) {
  if (event.dryRun) {
    return ok({
      dryRun: true,
      plans: PLAN_SEED,
    });
  }

  const now = Date.now();
  for (const seed of PLAN_SEED) {
    const existing = await collection('memberPlans').where({ planCode: seed.planCode }).limit(1).get();
    const current = existing.data[0] as (MemberPlanRecord & { _id: string }) | undefined;
    if (current?._id) {
      await collection('memberPlans').doc(current._id).update({
        data: {
          ...seed,
          updatedAt: now,
        },
      });
      continue;
    }

    await collection('memberPlans').add({
      data: {
        ...seed,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return ok({
    success: true,
    seededPlans: PLAN_SEED.length,
  });
}
