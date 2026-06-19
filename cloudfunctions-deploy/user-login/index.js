"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
const invite_reward_policy_1 = require("./shared/invite-reward-policy");
function createInviteCode(openid) {
    return `U${openid.slice(-6).toUpperCase()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0')}`;
}
async function grantInviteMilestoneOnce(inviterUserId, now) {
    const existing = await (0, db_1.collection)('pointsLedger')
        .where({
        userId: inviterUserId,
        type: 'invite_milestone',
    })
        .limit(1)
        .get();
    if (existing.data[0]) {
        return;
    }
    const relations = await (0, db_1.collection)('inviteRelations')
        .where({
        inviterUserId,
        status: 'active',
    })
        .get();
    if (!(0, invite_reward_policy_1.shouldGrantInviteMilestone)(relations.data.length)) {
        return;
    }
    await (0, db_1.collection)('users').doc(inviterUserId).update({
        data: {
            pointsBalance: db_1._.inc(invite_reward_policy_1.INVITE_MILESTONE_REWARD),
            updatedAt: now,
        },
    });
    const inviter = await (0, db_1.getUserById)(inviterUserId);
    const ledger = {
        userId: inviterUserId,
        type: 'invite_milestone',
        direction: 'in',
        points: invite_reward_policy_1.INVITE_MILESTONE_REWARD,
        balanceAfter: inviter === null || inviter === void 0 ? void 0 : inviter.pointsBalance,
        description: `累计邀请${invite_reward_policy_1.INVITE_MILESTONE_TARGET}人奖励${invite_reward_policy_1.INVITE_MILESTONE_REWARD} T币`,
        createdAt: now,
    };
    await (0, db_1.collection)('pointsLedger').add({ data: ledger });
}
async function bindInviteRelation(currentUser, event, now) {
    var _a, _b, _c, _d, _e, _f;
    const inviteCode = (_a = event.inviteCode) === null || _a === void 0 ? void 0 : _a.trim();
    if (currentUser.inviterUserId) {
        const existingRelation = await (0, db_1.collection)('inviteRelations')
            .where({ inviteeUserId: currentUser._id })
            .limit(1)
            .get();
        if (existingRelation.data[0]) {
            await grantInviteMilestoneOnce(currentUser.inviterUserId, now);
            console.info('invite.bind.skipped', {
                reason: 'already_bound',
                userId: currentUser._id,
                inviteCode,
                inviterUserId: currentUser.inviterUserId,
            });
            return currentUser.inviterUserId;
        }
        const inviter = await (0, db_1.collection)('users').doc(currentUser.inviterUserId).get();
        const inviterUser = inviter.data;
        await (0, db_1.collection)('inviteRelations').add({
            data: {
                inviterUserId: currentUser.inviterUserId,
                inviteeUserId: currentUser._id,
                inviteCode: inviteCode || (inviterUser === null || inviterUser === void 0 ? void 0 : inviterUser.inviteCode) || '',
                source: (_b = event.source) !== null && _b !== void 0 ? _b : 'backfill',
                status: 'active',
                createdAt: (_c = currentUser.createdAt) !== null && _c !== void 0 ? _c : now,
                updatedAt: now,
            },
        });
        console.info('invite.bind.backfilled', {
            inviterUserId: currentUser.inviterUserId,
            inviteeUserId: currentUser._id,
            inviteCode: inviteCode || (inviterUser === null || inviterUser === void 0 ? void 0 : inviterUser.inviteCode) || '',
            source: (_d = event.source) !== null && _d !== void 0 ? _d : 'backfill',
        });
        await grantInviteMilestoneOnce(currentUser.inviterUserId, now);
        return currentUser.inviterUserId;
    }
    if (!inviteCode) {
        console.info('invite.bind.skipped', {
            reason: 'missing_invite_code',
            userId: currentUser._id,
        });
        return undefined;
    }
    const inviter = await (0, db_1.getUserByInviteCode)(inviteCode);
    if (!inviter || inviter._id === currentUser._id) {
        console.info('invite.bind.skipped', {
            reason: !inviter ? 'inviter_not_found' : 'self_invite',
            userId: currentUser._id,
            inviteCode,
        });
        return currentUser.inviterUserId;
    }
    const existingRelation = await (0, db_1.collection)('inviteRelations')
        .where({ inviteeUserId: currentUser._id })
        .limit(1)
        .get();
    if (existingRelation.data[0]) {
        console.info('invite.bind.skipped', {
            reason: 'relation_exists',
            userId: currentUser._id,
            inviteCode,
        });
        return currentUser.inviterUserId;
    }
    await (0, db_1.collection)('inviteRelations').add({
        data: {
            inviterUserId: inviter._id,
            inviteeUserId: currentUser._id,
            inviteCode,
            source: (_e = event.source) !== null && _e !== void 0 ? _e : 'share',
            status: 'active',
            createdAt: now,
            updatedAt: now,
        },
    });
    console.info('invite.bind.created', {
        inviterUserId: inviter._id,
        inviteeUserId: currentUser._id,
        inviteCode,
        source: (_f = event.source) !== null && _f !== void 0 ? _f : 'share',
    });
    await grantInviteMilestoneOnce(inviter._id, now);
    return inviter._id;
}
async function main(event = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const now = Date.now();
    const { OPENID } = (0, context_1.getWxContext)();
    const existingUser = await (0, db_1.getUserByOpenId)(OPENID);
    if (existingUser) {
        const inviteCode = (_a = existingUser.inviteCode) !== null && _a !== void 0 ? _a : createInviteCode(OPENID);
        const aiAccountRegistered = Boolean(existingUser.aiAccountRegistered || existingUser.aiAccountEmail);
        const inviterUserId = await bindInviteRelation(existingUser, event, now);
        await (0, db_1.collection)('users').doc(existingUser._id).update({
            data: {
                nickname: (_c = (_b = event.nickname) !== null && _b !== void 0 ? _b : existingUser.nickname) !== null && _c !== void 0 ? _c : '',
                avatarUrl: (_e = (_d = event.avatarUrl) !== null && _d !== void 0 ? _d : existingUser.avatarUrl) !== null && _e !== void 0 ? _e : '',
                inviteCode,
                inviterUserId,
                aiAccountRegistered,
                lastLoginAt: now,
                updatedAt: now,
            },
        });
        await grantInviteMilestoneOnce(existingUser._id, now);
        const refreshedUser = await (0, db_1.getUserById)(existingUser._id);
        return (0, utils_1.ok)({
            userId: existingUser._id,
            openid: OPENID,
            openId: OPENID,
            mobileBound: Boolean(existingUser.mobile),
            nickname: (_f = event.nickname) !== null && _f !== void 0 ? _f : existingUser.nickname,
            avatarUrl: (_g = event.avatarUrl) !== null && _g !== void 0 ? _g : existingUser.avatarUrl,
            inviteCode,
            inviterUserId,
            pointsBalance: (_j = (_h = refreshedUser === null || refreshedUser === void 0 ? void 0 : refreshedUser.pointsBalance) !== null && _h !== void 0 ? _h : existingUser.pointsBalance) !== null && _j !== void 0 ? _j : 0,
            aiAccountRegistered,
        });
    }
    const user = {
        openid: OPENID,
        mobile: '',
        nickname: event.nickname,
        avatarUrl: event.avatarUrl,
        inviteCode: createInviteCode(OPENID),
        pointsBalance: 0,
        aiAccountRegistered: false,
        status: 'active',
        subscribeMsgAuth: false,
        newsSubscribeMsgAuth: false,
        newsSubscribeMsgQuota: 0,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now,
    };
    const result = await (0, db_1.collection)('users').add({ data: user });
    const createdUser = { ...user, _id: result._id };
    const inviterUserId = await bindInviteRelation(createdUser, event, now);
    if (inviterUserId) {
        await (0, db_1.collection)('users').doc(result._id).update({
            data: {
                inviterUserId,
                updatedAt: now,
            },
        });
    }
    return (0, utils_1.ok)({
        userId: result._id,
        openid: OPENID,
        openId: OPENID,
        mobileBound: false,
        nickname: user.nickname,
        avatarUrl: user.avatarUrl,
        inviteCode: user.inviteCode,
        inviterUserId,
        pointsBalance: user.pointsBalance,
        aiAccountRegistered: user.aiAccountRegistered,
    });
}
