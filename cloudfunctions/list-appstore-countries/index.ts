import { collection } from '../shared/db';
import { ok } from '../shared/utils';
import type { AppStoreCountryRecord, AppStoreCountryView } from '../shared/types';

function toAppStoreCountryView(record: AppStoreCountryRecord): AppStoreCountryView {
  return {
    countryCode: record.countryCode,
    countryName: record.countryName,
    dialingCode: record.dialingCode,
    available: record.available,
  };
}

export async function main() {
  const result = await collection('appstoreCountries')
    .where({ status: 'on' })
    .orderBy('sort', 'asc')
    .get();
  const countries = (result.data as AppStoreCountryRecord[]).map(toAppStoreCountryView);
  return ok({ countries });
}
