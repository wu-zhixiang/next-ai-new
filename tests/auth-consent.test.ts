import assert from 'node:assert/strict';
import test from 'node:test';

import { hasAuthConsent } from '../src/utils/authConsent.ts';

test('silent login user id does not count as explicit auth consent', () => {
  assert.equal(hasAuthConsent({ userId: 'user-1' }), false);
});

test('explicit auth consent allows protected purchase flows', () => {
  assert.equal(hasAuthConsent({ userId: 'user-1', authConsentGranted: true }), true);
});

test('legacy profile state does not bypass explicit auth consent', () => {
  assert.equal(hasAuthConsent({ userId: 'user-1', profileAuthed: true }), false);
});
