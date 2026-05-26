import { DEFAULT_PRODUCT_CODE, DEFAULT_PRODUCT_NAME } from './constants';
import { collection } from './db';
import type { MemberPlanRecord } from './types';

export const PLAN_SEED: MemberPlanRecord[] = [
  {
    productCode: DEFAULT_PRODUCT_CODE,
    productName: DEFAULT_PRODUCT_NAME,
    planCode: 'plus',
    planName: 'AI资讯PLUS会员',
    price: 0.01,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 1,
    description: 'PLUS月度会员套餐，适合深度资讯订阅场景。',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
  {
    productCode: DEFAULT_PRODUCT_CODE,
    productName: DEFAULT_PRODUCT_NAME,
    planCode: 'go',
    planName: 'AI资讯GO会员',
    price: 0.01,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 2,
    description: 'GO月度会员套餐，适合轻量资讯订阅场景。',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
];

const LEGACY_PLAN_CODES = ['annual', 'quarterly', 'monthly'];

export async function seedMemberPlans(now = Date.now()): Promise<number> {
  for (const planCode of LEGACY_PLAN_CODES) {
    const existing = await collection('memberPlans').where({ planCode }).limit(1).get();
    const current = existing.data[0] as (MemberPlanRecord & { _id: string }) | undefined;
    if (current?._id) {
      await collection('memberPlans').doc(current._id).update({
        data: {
          status: 'off',
          updatedAt: now,
        },
      });
    }
  }

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

  return PLAN_SEED.length;
}
