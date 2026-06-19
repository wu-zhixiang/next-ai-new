"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INVITE_MILESTONE_REWARD = exports.INVITE_MILESTONE_TARGET = exports.INVITE_PURCHASE_REWARD = exports.INVITE_PURCHASE_MIN_AMOUNT = void 0;
exports.calcInvitePurchaseReward = calcInvitePurchaseReward;
exports.shouldGrantInviteMilestone = shouldGrantInviteMilestone;
exports.INVITE_PURCHASE_MIN_AMOUNT = 50;
exports.INVITE_PURCHASE_REWARD = 5;
exports.INVITE_MILESTONE_TARGET = 10;
exports.INVITE_MILESTONE_REWARD = 10;
function calcInvitePurchaseReward(paidAmount) {
    return paidAmount > exports.INVITE_PURCHASE_MIN_AMOUNT ? exports.INVITE_PURCHASE_REWARD : 0;
}
function shouldGrantInviteMilestone(inviteCount) {
    return inviteCount >= exports.INVITE_MILESTONE_TARGET;
}
