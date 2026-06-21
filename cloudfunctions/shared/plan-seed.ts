import { collection, ensureCollection } from './db';
import { PLAN_SEED } from './plan-seed-data';
import type { MemberPlanRecord } from './types';
export { PLAN_SEED } from './plan-seed-data';

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
