import { collection, ensureCollection } from './db';
import { APPSTORE_COUNTRY_SEED } from './appstore-country-data';
import type { AppStoreCountryRecord } from './types';

export { APPSTORE_COUNTRY_SEED } from './appstore-country-data';

export async function seedAppStoreCountries(now = Date.now()): Promise<number> {
  await ensureCollection('appstoreCountries');

  for (const seed of APPSTORE_COUNTRY_SEED) {
    const existing = await collection('appstoreCountries').where({ countryCode: seed.countryCode }).limit(1).get();
    const current = existing.data[0] as (AppStoreCountryRecord & { _id: string }) | undefined;
    if (current?._id) {
      await collection('appstoreCountries').doc(current._id).update({
        data: {
          ...seed,
          updatedAt: now,
        },
      });
      continue;
    }

    await collection('appstoreCountries').add({
      data: {
        ...seed,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return APPSTORE_COUNTRY_SEED.length;
}
