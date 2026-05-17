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

  const plans = result.data.map((item) => {
    const plan = item as MemberPlanRecord;
    return {
      productCode: plan.productCode,
      productName: plan.productName,
      planCode: plan.planCode,
      planName: plan.planName,
      price: plan.price,
      durationDays: plan.durationDays,
      description: plan.description,
    };
  });

  return ok({ plans });
}
