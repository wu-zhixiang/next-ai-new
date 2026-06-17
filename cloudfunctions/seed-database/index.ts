import { PLAN_SEED, seedMemberPlans } from '../shared/plan-seed';
import { APPSTORE_COUNTRY_SEED, seedAppStoreCountries } from '../shared/appstore-country-seed';
import { PRODUCT_TYPE_SEED, seedProductTypes } from '../shared/product-type-seed';
import { ok } from '../shared/utils';

interface Event {
  dryRun?: boolean;
}

export async function main(event: Event = {}) {
  if (event.dryRun) {
    return ok({
      dryRun: true,
      productTypes: PRODUCT_TYPE_SEED,
      appStoreCountries: APPSTORE_COUNTRY_SEED,
      plans: PLAN_SEED,
    });
  }

  const seededProductTypes = await seedProductTypes();
  const seededAppStoreCountries = await seedAppStoreCountries();
  const seededPlans = await seedMemberPlans();

  return ok({
    success: true,
    seededProductTypes,
    seededAppStoreCountries,
    seededPlans,
  });
}
