import { collection, ensureCollection } from './db';
import type { AppStoreCountryRecord } from './types';

export const APPSTORE_COUNTRY_SEED: AppStoreCountryRecord[] = [
  {
    countryCode: 'PH',
    countryName: '菲律宾',
    dialingCode: '+63',
    available: true,
    sort: 1,
    status: 'on',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
  {
    countryCode: 'NG',
    countryName: '尼日利亚',
    dialingCode: '+234',
    available: true,
    sort: 2,
    status: 'on',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
];

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
