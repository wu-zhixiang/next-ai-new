import { PLAN_SEED, seedMemberPlans } from '../shared/plan-seed';
import { ok } from '../shared/utils';

interface Event {
  dryRun?: boolean;
}

export async function main(event: Event = {}) {
  if (event.dryRun) {
    return ok({
      dryRun: true,
      plans: PLAN_SEED,
    });
  }

  const seededPlans = await seedMemberPlans();

  return ok({
    success: true,
    seededPlans,
  });
}
