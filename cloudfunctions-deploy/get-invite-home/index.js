"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
async function main() {
    var _a, _b;
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    if (!user) {
        throw new Error('用户未登录');
    }
    const relations = await (0, db_1.listInviteRelationsByInviterId)(user._id);
    const inviteeIds = relations.map((relation) => relation.inviteeUserId);
    const usersById = new Map();
    if (inviteeIds.length > 0) {
        const usersResult = await (0, db_1.collection)('users')
            .where({
            _id: db_1._.in(inviteeIds),
        })
            .get();
        for (const item of usersResult.data) {
            usersById.set(item._id, item);
        }
    }
    const ledgersResult = await (0, db_1.collection)('pointsLedger')
        .where({
        userId: user._id,
        type: 'invite_reward',
    })
        .get();
    const rewardLedgers = ledgersResult.data;
    const rewardByInvitee = new Map();
    for (const ledger of rewardLedgers) {
        const relatedUserId = ledger.relatedUserId;
        if (!relatedUserId)
            continue;
        rewardByInvitee.set(relatedUserId, ((_a = rewardByInvitee.get(relatedUserId)) !== null && _a !== void 0 ? _a : 0) + ledger.points);
    }
    const invitees = relations.map((relation) => {
        var _a;
        const invitee = usersById.get(relation.inviteeUserId);
        return {
            userId: relation.inviteeUserId,
            nickname: (invitee === null || invitee === void 0 ? void 0 : invitee.nickname) || `用户${relation.inviteeUserId.slice(-4)}`,
            avatarUrl: invitee === null || invitee === void 0 ? void 0 : invitee.avatarUrl,
            joinedAt: relation.createdAt,
            status: '已加入',
            rewardPoints: (_a = rewardByInvitee.get(relation.inviteeUserId)) !== null && _a !== void 0 ? _a : 0,
        };
    });
    const totalRewardPoints = rewardLedgers.reduce((total, ledger) => total + ledger.points, 0);
    return (0, utils_1.ok)({
        inviteCode: user.inviteCode,
        inviteCount: invitees.length,
        pointsBalance: (_b = user.pointsBalance) !== null && _b !== void 0 ? _b : 0,
        totalRewardPoints,
        invitees,
    });
}
