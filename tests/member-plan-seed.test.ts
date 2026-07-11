import assert from 'node:assert/strict';
import test from 'node:test';

import { PLAN_SEED } from '../cloudfunctions/shared/plan-seed-data.ts';

test('member plan seed includes the requested Chatgpt plans', () => {
  const expectedPlans = [
    {
      productCode: 'ai_news',
      planCode: 'all_in_one',
      planName: 'Chatgpt 标准版',
      virtualPaymentProductId: 'aionhub_all_in_one',
      price: 199,
      durationDays: 30,
    },
    {
      productCode: 'ai_news',
      planCode: 'codex_trial',
      planName: 'Codex 体验版',
      virtualPaymentProductId: 'aionhub_codex_trial',
      price: 40,
      durationDays: 30,
    },
    {
      productCode: 'ai_news',
      planCode: 'codex_basic',
      planName: 'Codex 标准版',
      virtualPaymentProductId: 'aionhub_codex_basic',
      price: 160,
      durationDays: 30,
    },
    {
      productCode: 'ai_news',
      planCode: 'codex_pro',
      planName: 'Codex 专业版',
      virtualPaymentProductId: 'aionhub_codex_pro',
      price: 799,
      durationDays: 30,
    },
    {
      productCode: 'ai_news',
      planCode: 'ultimate',
      planName: 'Chatgpt 专业版',
      virtualPaymentProductId: 'aionhub_ultimate',
      price: 899,
      durationDays: 30,
    },
    {
      productCode: 'quota_points',
      planCode: 'quota_40',
      planName: '40 ¥ 额度包',
      virtualPaymentProductId: 'aionhub_quota_40',
      price: 40,
      durationDays: 30,
    },
    {
      productCode: 'quota_points',
      planCode: 'quota_80',
      planName: '80 ¥ 额度包',
      virtualPaymentProductId: 'aionhub_quota_80',
      price: 80,
      durationDays: 30,
    },
    {
      productCode: 'quota_points',
      planCode: 'quota_160',
      planName: '160 ¥ 额度包',
      virtualPaymentProductId: 'aionhub_quota_160',
      price: 160,
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
    assert.equal(plan.status, 'off');
  }
});

test('quota point plans include AI tool point totals', () => {
  const quotaPlans = PLAN_SEED.filter((plan) => plan.productCode === 'quota_points');
  assert.deepEqual(
    quotaPlans.map((plan) => [plan.planCode, plan.totalAiPoints]),
    [
      ['quota_40', 400],
      ['quota_80', 800],
      ['quota_160', 1600],
    ],
  );
});

test('member plan seed hides Claude plans for now', () => {
  assert.equal(PLAN_SEED.some((plan) => plan.productCode === 'claude_pro' && plan.status === 'on'), false);
});

test('member plan seed orders Codex plans before Chatgpt plans', () => {
  const orderedPlanCodes = PLAN_SEED
    .filter((plan) => plan.productCode === 'ai_news')
    .sort((left, right) => left.sort - right.sort)
    .map((plan) => plan.planCode);

  assert.deepEqual(orderedPlanCodes, [
    'codex_trial',
    'codex_basic',
    'codex_pro',
    'all_in_one',
    'ultimate',
  ]);
});

test('codex plans describe light ChatGPT usage support', () => {
  const codexPlans = PLAN_SEED.filter((plan) => plan.productCode === 'ai_news' && plan.planCode.startsWith('codex_'));
  assert.equal(codexPlans.length, 3);
  for (const plan of codexPlans) {
    assert.match(plan.description, /ChatGPT 轻度使用/);
  }
});

test('member plan seed keeps plan ids unique', () => {
  const pids = PLAN_SEED.map((plan) => plan.pid);
  assert.equal(new Set(pids).size, pids.length);
});
