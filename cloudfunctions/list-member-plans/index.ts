import { collection } from '../shared/db';
import { ok } from '../shared/utils';
import type { MemberPlanRecord } from '../shared/types';

interface Event {
  productCode?: string;
}

export async function main(event: Event = {}) {
  const query = event.productCode ? { status: 'on', productCode: event.productCode } : { status: 'on' };
  const result = await collection('memberPlans')
    .where(query)
    .orderBy('sort', 'asc')
    .get();
  const plans = (result.data as MemberPlanRecord[]).map((item) => {
    const plan = item as MemberPlanRecord;
    return {
      pid: plan.pid,
      productCode: plan.productCode,
      productName: plan.productName,
      planCode: plan.planCode,
      planName: plan.planName,
      price: plan.price,
      totalAiPoints: plan.totalAiPoints ?? 0,
      durationDays: plan.durationDays,
      description: plan.description,
      complianceEnabled: plan.complianceEnabled ?? Boolean(plan.complianceDisplay),
      complianceDisplay: plan.complianceDisplay,
    };
  });

  return ok({ plans });
}
