import assert from 'node:assert/strict';
import test from 'node:test';

import { formatMobileDisplay, isMobileBound, maskMobile } from '../src/utils/mobile.ts';

test('maskMobile masks mainland mobile numbers', () => {
  assert.equal(maskMobile('13812345678'), '138****5678');
});

test('formatMobileDisplay returns fallback when missing', () => {
  assert.equal(formatMobileDisplay(''), '未绑定手机号');
});

test('isMobileBound reflects presence of a masked mobile value', () => {
  assert.equal(isMobileBound('138****5678'), true);
  assert.equal(isMobileBound(''), false);
});
