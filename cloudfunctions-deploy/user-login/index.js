"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
const context_1 = require("./_lib/context");
function createInviteCode(openid) {
    return `U${openid.slice(-6).toUpperCase()}${Math.floor(Math.random() * 1000)
        .toString()
        .padStart(3, '0')}`;
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
                pointsBalance: (_f = existingUser.pointsBalance) !== null && _f !== void 0 ? _f : 0,
                aiAccountRegistered,
                lastLoginAt: now,
                updatedAt: now,
            },
        });
        return (0, utils_1.ok)({
            userId: existingUser._id,
            openid: OPENID,
            openId: OPENID,
            mobileBound: Boolean(existingUser.mobile),
            nickname: (_g = event.nickname) !== null && _g !== void 0 ? _g : existingUser.nickname,
            avatarUrl: (_h = event.avatarUrl) !== null && _h !== void 0 ? _h : existingUser.avatarUrl,
            inviteCode,
            inviterUserId,
            pointsBalance: (_j = existingUser.pointsBalance) !== null && _j !== void 0 ? _j : 0,
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
