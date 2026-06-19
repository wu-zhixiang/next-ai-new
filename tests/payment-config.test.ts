import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizePaymentType,
  paymentTypeToPayChannel,
} from '../cloudfunctions/shared/payment-config.ts';

test('payment config keeps virtual payment as the backward-compatible default', () => {
  assert.equal(normalizePaymentType(undefined), 'virtual');
  assert.equal(normalizePaymentType('invalid'), 'virtual');
  assert.equal(paymentTypeToPayChannel('virtual'), 'wechat_virtual_pay');
});

test('payment config maps standard payment to the normal WeChat pay channel', () => {
  assert.equal(normalizePaymentType('standard'), 'standard');
  assert.equal(paymentTypeToPayChannel('standard'), 'wechat_pay');
});
