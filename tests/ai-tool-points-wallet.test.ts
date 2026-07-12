import assert from 'node:assert/strict';
import test from 'node:test';

import { planAiToolPointBucketDeductions } from '../cloudfunctions/shared/ai-tool-points-policy.ts';
import type { AiToolPointBucketRecord } from '../cloudfunctions/shared/types.ts';

function bucket(input: Partial<AiToolPointBucketRecord> & { _id: string }): AiToolPointBucketRecord & { _id: string } {
  return {
    userId: 'user_1',
    sourceType: 'plan',
    pointsTotal: 0,
    pointsRemaining: 0,
    status: 'active',
    createdAt: 0,
    updatedAt: 0,
    ...input,
  };
}

test('AI tool point wallet consumes expiring plan points before permanent adjustment points', () => {
  const now = 1000;
  const deductions = planAiToolPointBucketDeductions([
    bucket({ _id: 'adjustment_bucket', sourceType: 'adjustment', pointsRemaining: 100, createdAt: 1 }),
    bucket({ _id: 'plan_later', sourceType: 'plan', pointsRemaining: 50, expiresAt: 4000, createdAt: 2 }),
    bucket({ _id: 'plan_earlier', sourceType: 'plan', pointsRemaining: 30, expiresAt: 3000, createdAt: 3 }),
  ], 90, now);

  assert.deepEqual(deductions, [
    { bucketId: 'plan_earlier', sourceType: 'plan', points: 30, expiresAt: 3000 },
    { bucketId: 'plan_later', sourceType: 'plan', points: 50, expiresAt: 4000 },
    { bucketId: 'adjustment_bucket', sourceType: 'adjustment', points: 10, expiresAt: undefined },
  ]);
});

test('AI tool point wallet ignores expired buckets when planning deductions', () => {
  const deductions = planAiToolPointBucketDeductions([
    bucket({ _id: 'expired_plan', sourceType: 'plan', pointsRemaining: 100, expiresAt: 900 }),
    bucket({ _id: 'adjustment_bucket', sourceType: 'adjustment', pointsRemaining: 20 }),
  ], 20, 1000);

  assert.deepEqual(deductions, [
    { bucketId: 'adjustment_bucket', sourceType: 'adjustment', points: 20, expiresAt: undefined },
  ]);
});
