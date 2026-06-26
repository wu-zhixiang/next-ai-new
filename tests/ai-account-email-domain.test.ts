import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN,
  getAiAccountEmailSuffix,
  isValidAiAccountEmailDomain,
  normalizeAiAccountEmailDomain,
  selectAvailableAiAccountEmailDomain,
} from '../cloudfunctions/shared/ai-account-email-domain-core.ts';

test('AI account email domain selector picks first available enabled domain by sort', () => {
  const domain = selectAvailableAiAccountEmailDomain([
    { domain: 'disabled.example.com', available: true, status: 'off', sort: 1 },
    { domain: '@second.example.com', available: true, status: 'on', sort: 20 },
    { domain: 'first.example.com', available: true, status: 'on', sort: 10 },
    { domain: 'unavailable.example.com', available: false, status: 'on', sort: 0 },
  ]);

  assert.equal(domain, 'first.example.com');
});

test('AI account email domain selector ignores invalid domains and returns null when none are available', () => {
  assert.equal(selectAvailableAiAccountEmailDomain([]), null);
  assert.equal(
    selectAvailableAiAccountEmailDomain([
      { domain: 'not a domain', available: true, status: 'on', sort: 1 },
      { domain: 'off.example.com', available: true, status: 'off', sort: 2 },
    ]),
    null,
  );
  assert.equal(DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN, 'mraclpivot.com');
});

test('AI account email domain helpers normalize and validate suffixes', () => {
  assert.equal(normalizeAiAccountEmailDomain(' @Example.COM '), 'example.com');
  assert.equal(getAiAccountEmailSuffix('Example.COM'), '@example.com');
  assert.equal(isValidAiAccountEmailDomain('example.com'), true);
  assert.equal(isValidAiAccountEmailDomain('example'), false);
});
