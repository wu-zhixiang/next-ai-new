export const INVITE_PURCHASE_MIN_AMOUNT = 50;
export const INVITE_PURCHASE_REWARD = 5;
export const INVITE_MILESTONE_TARGET = 10;
export const INVITE_MILESTONE_REWARD = 10;

export function calcInvitePurchaseReward(paidAmount: number): number {
  return paidAmount > INVITE_PURCHASE_MIN_AMOUNT ? INVITE_PURCHASE_REWARD : 0;
}

export function shouldGrantInviteMilestone(inviteCount: number): boolean {
  return inviteCount >= INVITE_MILESTONE_TARGET;
}
