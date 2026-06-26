import { PLAN_SEED, seedMemberPlans, seedPlanComplianceDisplays } from '../shared/plan-seed';
import { APPSTORE_COUNTRY_SEED, seedAppStoreCountries } from '../shared/appstore-country-seed';
import {
  PRODUCT_TYPE_SEED,
  seedProductTypeComplianceDisplays,
  seedProductTypes,
} from '../shared/product-type-seed';
import { AI_ACCOUNT_EMAIL_DOMAIN_SEED, seedAiAccountEmailDomains } from '../shared/ai-account-email-domain';
import { ok } from '../shared/utils';

interface Event {
  dryRun?: boolean;
  action?: 'full' | 'member-plans' | 'compliance-display';
}

export async function main(event: Event = {}) {
  if (event.action === 'member-plans') {
    const seededPlans = await seedMemberPlans();
    return ok({
      success: true,
      action: event.action,
      seededPlans,
    });
  }

  if (event.action === 'compliance-display') {
    const updatedProductTypes = await seedProductTypeComplianceDisplays();
    const updatedPlans = await seedPlanComplianceDisplays();
    return ok({
      success: true,
      action: event.action,
      updatedProductTypes,
      updatedPlans,
    });
  }

  if (event.dryRun) {
    return ok({
      dryRun: true,
      productTypes: PRODUCT_TYPE_SEED,
      aiAccountEmailDomains: AI_ACCOUNT_EMAIL_DOMAIN_SEED,
      appStoreCountries: APPSTORE_COUNTRY_SEED,
      plans: PLAN_SEED,
    });
  }

  const seededProductTypes = await seedProductTypes();
  const seededAiAccountEmailDomains = await seedAiAccountEmailDomains();
  const seededAppStoreCountries = await seedAppStoreCountries();
  const seededPlans = await seedMemberPlans();

  return ok({
    success: true,
    seededProductTypes,
    seededAiAccountEmailDomains,
    seededAppStoreCountries,
    seededPlans,
  });
}
