import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_INVITE_BASE_REWARD_POINTS,
  DEFAULT_POINTS_PER_YUAN,
  calculatePointsDeduction,
  normalizeInviteMilestones,
  normalizePointsConfigRecord,
} from '../cloudfunctions/shared/points-config-core.ts';

test('default points policy uses invitation rewards only', () => {
  const config = normalizePointsConfigRecord(null);

  assert.equal(DEFAULT_POINTS_PER_YUAN, 10);
  assert.equal(DEFAULT_INVITE_BASE_REWARD_POINTS, 5);
  assert.equal(config.pointsPerYuan, 10);
  assert.equal(config.inviteBaseRewardPoints, 5);
  assert.deepEqual(config.inviteMilestones, []);
});

test('points deduction uses configurable points per yuan', () => {
  assert.deepEqual(
    calculatePointsDeduction({
      price: 2.5,
      availablePoints: 25,
      usePointsDeduction: true,
      pointsPerYuan: 10,
    }),
    {
      pointsDeducted: 25,
      pointsDeductAmount: 2.5,
      payableAmount: 0,
    },
  );
});

test('invite milestones are configurable and sorted', () => {
  assert.deepEqual(
    normalizeInviteMilestones([
      { inviteCount: 20, rewardPoints: 30, enabled: true },
      { inviteCount: 10, rewardPoints: 10, enabled: true },
      { inviteCount: 5, rewardPoints: 0, enabled: true },
    ]),
    [
      { id: 'invite_10', inviteCount: 10, rewardPoints: 10, enabled: true, description: '' },
      { id: 'invite_20', inviteCount: 20, rewardPoints: 30, enabled: true, description: '' },
    ],
  );
});
