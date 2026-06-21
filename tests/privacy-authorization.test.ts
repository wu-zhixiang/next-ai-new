import assert from 'node:assert/strict';
import test from 'node:test';

import { requestPrivacyAuthorization } from '../src/utils/privacyAuthorizationCore.ts';

test('privacy authorization succeeds when the platform authorizes it', async () => {
  const authorized = await requestPrivacyAuthorization({
    requirePrivacyAuthorize: ({ success }) => {
      success?.({ errMsg: 'requirePrivacyAuthorize:ok' });
    },
  });

  assert.equal(authorized, true);
});

test('privacy authorization fails when the user rejects it', async () => {
  const authorized = await requestPrivacyAuthorization({
    requirePrivacyAuthorize: ({ fail }) => {
      fail?.({ errMsg: 'requirePrivacyAuthorize:fail privacy permission is not authorized' });
    },
  });

  assert.equal(authorized, false);
});

test('privacy authorization remains compatible with unsupported platforms', async () => {
  assert.equal(await requestPrivacyAuthorization({}), true);
});
