import assert from 'node:assert/strict';
import test from 'node:test';

import { APPSTORE_COUNTRY_SEED } from '../cloudfunctions/shared/appstore-country-data.ts';

test('Apple Store country seed includes the United States', () => {
  const unitedStates = APPSTORE_COUNTRY_SEED.find((country) => country.countryCode === 'US');

  assert.deepEqual(unitedStates, {
    countryCode: 'US',
    countryName: '美国',
    dialingCode: '+1',
    available: true,
    sort: 3,
    status: 'on',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  });
});
