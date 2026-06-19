import assert from 'node:assert/strict';
import test from 'node:test';

import {
  INVITE_MILESTONE_REWARD,
  INVITE_MILESTONE_TARGET,
  calcInvitePurchaseReward,
  shouldGrantInviteMilestone,
} from '../cloudfunctions/shared/invite-reward-policy.ts';

test('invite purchase reward requires the paid amount to exceed 50 yuan', () => {
  assert.equal(calcInvitePurchaseReward(0), 0);
  assert.equal(calcInvitePurchaseReward(50), 0);
  assert.equal(calcInvitePurchaseReward(50.01), 5);
  assert.equal(calcInvitePurchaseReward(460), 5);
});

test('invite milestone grants 10 T coins when the invite count reaches 10', () => {
  assert.equal(INVITE_MILESTONE_TARGET, 10);
  assert.equal(INVITE_MILESTONE_REWARD, 10);
  assert.equal(shouldGrantInviteMilestone(9), false);
  assert.equal(shouldGrantInviteMilestone(10), true);
  assert.equal(shouldGrantInviteMilestone(11), true);
});
