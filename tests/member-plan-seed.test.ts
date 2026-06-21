import assert from 'node:assert/strict';
import test from 'node:test';

import { PLAN_SEED } from '../cloudfunctions/shared/plan-seed-data.ts';

test('member plan seed includes the requested ChatGPT and Claude plans', () => {
  const expectedPlans = [
    {
      productCode: 'ai_news',
      planCode: 'go',
      planName: 'ChatGPT Go',
      virtualPaymentProductId: 'chatgpt_go',
      price: 64,
      durationDays: 30,
    },
    {
      productCode: 'ai_news',
      planCode: 'pro_5x',
      planName: 'ChatGPT Pro 5x',
      virtualPaymentProductId: 'chatgpt_pro_5x',
      price: 719,
      durationDays: 30,
    },
    {
      productCode: 'claude_pro',
      planCode: 'pro',
      planName: 'Claude Pro',
      virtualPaymentProductId: 'claude_pro',
      price: 160,
      durationDays: 30,
    },
    {
      productCode: 'claude_pro',
      planCode: 'max_5x',
      planName: 'Claude Max 5x',
      virtualPaymentProductId: 'claude_max_5x',
      price: 899,
      durationDays: 30,
    },
  ];

  for (const expected of expectedPlans) {
    const plan = PLAN_SEED.find((item) => (
      item.productCode === expected.productCode
      && item.planCode === expected.planCode
    ));
    assert.ok(plan, `${expected.planName} should exist`);
    assert.equal(plan.planName, expected.planName);
    assert.equal(plan.virtualPaymentProductId, expected.virtualPaymentProductId);
    assert.equal(plan.price, expected.price);
    assert.equal(plan.durationDays, expected.durationDays);
    assert.equal(plan.status, 'on');
  }
});

test('member plan seed keeps plan ids unique', () => {
  const pids = PLAN_SEED.map((plan) => plan.pid);
  assert.equal(new Set(pids).size, pids.length);
});
