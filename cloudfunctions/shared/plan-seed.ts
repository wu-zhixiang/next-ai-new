import { DEFAULT_PRODUCT_CODE } from './constants';
import { collection, ensureCollection } from './db';
import type { MemberPlanRecord } from './types';

const SEED_TIME = 1746921600000;

interface PlanSeedCollection {
  get(): Promise<{ data: unknown[] }>;
  where(query: Record<string, unknown>): {
    limit(value: number): {
      get(): Promise<{ data: unknown[] }>;
    };
  };
  doc(id: string): {
    update(payload: { data: unknown }): Promise<unknown>;
    remove(): Promise<unknown>;
  };
  add(payload: { data: unknown }): Promise<unknown>;
}

function generatePlanPid(productCode: string, planCode: string): string {
  return `${productCode}_${planCode}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}

const PLAN_SEED_SOURCE: Array<Omit<MemberPlanRecord, 'pid' | 'createdAt' | 'updatedAt'>> = [
  {
    productCode: DEFAULT_PRODUCT_CODE,
    productName: 'ChatGPT Plus',
    planCode: 'plus',
    planName: 'ChatGPT Plus',
    virtualPaymentProductId: 'chatgpt_plus',
    price: 160,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 1,
    description: 'ChatGPT Plus 月度会员套餐。',
    complianceDisplay: {
      productName: 'AI效率会员',
      planName: 'AI效率会员月度套餐',
      description: 'AI效率服务月度套餐。',
    },
  },
  {
    productCode: DEFAULT_PRODUCT_CODE,
    productName: 'ChatGPT Plus',
    planCode: 'quarterly',
    planName: 'ChatGPT Plus 季度会员',
    virtualPaymentProductId: 'chatgpt_qtr',
    price: 460,
    durationDays: 90,
    autoRenewEnabled: false,
    status: 'on',
    sort: 2,
    description: 'ChatGPT Plus 季度会员套餐。',
    complianceDisplay: {
      productName: 'AI效率会员',
      planName: 'AI效率会员季度套餐',
      description: 'AI效率服务季度套餐。',
    },
  },
  {
    productCode: 'claude_pro',
    productName: 'Claude Pro',
    planCode: 'pro',
    planName: 'Claude Pro',
    virtualPaymentProductId: 'claude_pro',
    price: 128,
    durationDays: 30,
    autoRenewEnabled: false,
    status: 'on',
    sort: 3,
    description: 'Claude Pro 月度会员套餐。',
    complianceDisplay: {
      productName: 'AI创作会员',
      planName: 'AI创作会员月度套餐',
      description: 'AI创作服务月度套餐。',
    },
  },
];

export const PLAN_SEED: MemberPlanRecord[] = PLAN_SEED_SOURCE.map((seed) => ({
  ...seed,
  pid: generatePlanPid(seed.productCode, seed.planCode),
  createdAt: SEED_TIME,
  updatedAt: SEED_TIME,
}));

export async function seedMemberPlans(now = Date.now()): Promise<number> {
  await ensureCollection('memberPlans');

  const plans = collection('memberPlans') as unknown as PlanSeedCollection;
  const targetPids = new Set(PLAN_SEED.map((seed) => seed.pid));
  const currentPlans = (await plans.get()).data as Array<MemberPlanRecord & { _id: string }>;
  for (const plan of currentPlans) {
    if (plan._id && (!plan.pid || !targetPids.has(plan.pid))) {
      await plans.doc(plan._id).remove();
    }
  }

  for (const seed of PLAN_SEED) {
    const existing = await plans.where({ pid: seed.pid }).limit(1).get();
    const current = existing.data[0] as (MemberPlanRecord & { _id: string }) | undefined;
    if (current?._id) {
      await plans.doc(current._id).update({
        data: {
          ...seed,
          updatedAt: now,
        },
      });
      continue;
    }

    await plans.add({
      data: {
        ...seed,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return PLAN_SEED.length;
}

export async function seedPlanComplianceDisplays(now = Date.now()): Promise<number> {
  await ensureCollection('memberPlans');
  const plans = collection('memberPlans') as unknown as PlanSeedCollection;
  let updated = 0;
  for (const seed of PLAN_SEED) {
    const existing = await plans.where({ pid: seed.pid }).limit(1).get();
    const current = existing.data[0] as (MemberPlanRecord & { _id: string }) | undefined;
    if (!current?._id || !seed.complianceDisplay) continue;
    await plans.doc(current._id).update({
      data: {
        complianceDisplay: seed.complianceDisplay,
        updatedAt: now,
      },
    });
    updated += 1;
  }
  return updated;
}
