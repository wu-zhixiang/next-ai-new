"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const constants_1 = require("./shared/constants");
const db_1 = require("./shared/db");
const appstore_country_seed_1 = require("./shared/appstore-country-seed");
const ai_account_email_domain_1 = require("./shared/ai-account-email-domain");
const plan_seed_1 = require("./shared/plan-seed");
const product_type_seed_1 = require("./shared/product-type-seed");
const utils_1 = require("./shared/utils");
const CONFIRM_TEXT = 'RESET_TEST_DATABASE';
const INVITE_REWARDS_CONFIRM_TEXT = 'RESET_INVITE_REWARDS';
const INVITE_LEDGER_TYPES = ['invite_reward', 'invite_milestone'];
const DEFAULT_CLEAR_COLLECTIONS = [
    'memberships',
    'orders',
    'deliveries',
    'inviteRelations',
    'pointsLedger',
    'emailVerificationCodes',
    'aiNews',
    'aiToolRuns',
    'aiToolAssets',
    'aiToolUsageDaily',
    'aiToolUserUsage',
    'aiToolPointsLedger',
    'aiToolSingleEntitlements',
    'aiToolTemplates',
    'reminderLogs',
    'auditLogs',
];
async function countCollection(name) {
    const result = await (0, db_1.collection)(name).count();
    return result.total;
}
async function clearCollection(name) {
    const target = (0, db_1.collection)(name);
    let removed = 0;
    while (true) {
        const result = await target.limit(100).get();
        const docs = result.data;
        if (docs.length === 0) {
            break;
        }
        for (const doc of docs) {
            if (!doc._id) {
                continue;
            }
            await target.doc(doc._id).remove();
            removed += 1;
        }
    }
    return removed;
}
async function listCollectionDocs(name, where) {
    const target = (0, db_1.collection)(name);
    let query = where ? target.where(where) : target;
    const docs = [];
    let offset = 0;
    while (true) {
        const result = await query.skip(offset).limit(100).get();
        docs.push(...result.data);
        if (result.data.length < 100) {
            break;
        }
        offset += 100;
    }
    return docs;
}
async function removeDocs(name, docs) {
    const target = (0, db_1.collection)(name);
    let removed = 0;
    for (const doc of docs) {
        if (!doc._id) {
            continue;
        }
        await target.doc(doc._id).remove();
        removed += 1;
    }
    return removed;
}
function buildDeductions(ledgers) {
    var _a, _b;
    const deductions = new Map();
    for (const ledger of ledgers) {
        if (!ledger.userId) {
            continue;
        }
        const points = Math.max(0, Math.floor(Number((_a = ledger.points) !== null && _a !== void 0 ? _a : 0)));
        if (points <= 0) {
            continue;
        }
        deductions.set(ledger.userId, ((_b = deductions.get(ledger.userId)) !== null && _b !== void 0 ? _b : 0) + points);
    }
    return deductions;
}
function sumDeductions(deductions) {
    let total = 0;
    deductions.forEach((points) => {
        total += points;
    });
    return total;
}
async function applyUserInviteReset(params) {
    var _a, _b, _c, _d;
    const target = (0, db_1.collection)('users');
    const users = await listCollectionDocs('users');
    let updated = 0;
    for (const user of users) {
        if (!user._id) {
            continue;
        }
        const tCoinDeduction = (_a = params.tCoinDeductions.get(user._id)) !== null && _a !== void 0 ? _a : 0;
        const aiToolPointDeduction = (_b = params.aiToolPointDeductions.get(user._id)) !== null && _b !== void 0 ? _b : 0;
        const currentPointsBalance = Math.max(0, Math.floor(Number((_c = user.pointsBalance) !== null && _c !== void 0 ? _c : 0)));
        const currentAiToolPointsBalance = Math.max(0, Math.floor(Number((_d = user.aiToolPointsBalance) !== null && _d !== void 0 ? _d : 0)));
        const nextPointsBalance = Math.max(0, currentPointsBalance - tCoinDeduction);
        const nextAiToolPointsBalance = Math.max(0, currentAiToolPointsBalance - aiToolPointDeduction);
        const shouldUpdate = Boolean(user.inviterUserId)
            || nextPointsBalance !== currentPointsBalance
            || nextAiToolPointsBalance !== currentAiToolPointsBalance;
        if (!shouldUpdate) {
            continue;
        }
        await target.doc(user._id).update({
            data: {
                inviterUserId: '',
                pointsBalance: nextPointsBalance,
                aiToolPointsBalance: nextAiToolPointsBalance,
                updatedAt: Date.now(),
            },
        });
        updated += 1;
    }
    return updated;
}
async function resetInviteRewards(event) {
    if (event.confirm !== INVITE_REWARDS_CONFIRM_TEXT) {
        throw new Error(`清除邀请关系需要确认参数 confirm="${INVITE_REWARDS_CONFIRM_TEXT}"`);
    }
    const [inviteRelations, pointsLedgers, aiToolPointsLedgers] = await Promise.all([
        listCollectionDocs('inviteRelations'),
        listCollectionDocs('pointsLedger', { type: db_1._.in(INVITE_LEDGER_TYPES) }),
        listCollectionDocs('aiToolPointsLedger', { type: db_1._.in(INVITE_LEDGER_TYPES) }),
    ]);
    const tCoinDeductions = buildDeductions(pointsLedgers);
    const aiToolPointDeductions = buildDeductions(aiToolPointsLedgers);
    const preview = {
        inviteRelations: inviteRelations.length,
        pointsLedgerInviteRewards: pointsLedgers.length,
        aiToolPointsLedgerInviteRewards: aiToolPointsLedgers.length,
        tCoinUsersToDeduct: tCoinDeductions.size,
        tCoinTotalToDeduct: sumDeductions(tCoinDeductions),
        aiToolPointUsersToDeduct: aiToolPointDeductions.size,
        aiToolPointTotalToDeduct: sumDeductions(aiToolPointDeductions),
    };
    if (event.dryRun) {
        return (0, utils_1.ok)({
            action: 'invite-rewards',
            dryRun: true,
            preview,
        });
    }
    const resetUsersCount = await applyUserInviteReset({
        tCoinDeductions,
        aiToolPointDeductions,
    });
    const removedInviteRelations = await removeDocs('inviteRelations', inviteRelations);
    const removedPointsLedgers = await removeDocs('pointsLedger', pointsLedgers);
    const removedAiToolPointsLedgers = await removeDocs('aiToolPointsLedger', aiToolPointsLedgers);
    return (0, utils_1.ok)({
        action: 'invite-rewards',
        success: true,
        preview,
        resetUsersCount,
        removed: {
            inviteRelations: removedInviteRelations,
            pointsLedgerInviteRewards: removedPointsLedgers,
            aiToolPointsLedgerInviteRewards: removedAiToolPointsLedgers,
        },
    });
}
async function resetUserPoints() {
    const users = (0, db_1.collection)('users');
    let updated = 0;
    while (true) {
        const result = await users.limit(100).get();
        const docs = result.data.filter((doc) => Boolean(doc._id));
        if (docs.length === 0) {
            break;
        }
        for (const doc of docs) {
            if (!doc._id) {
                continue;
            }
            await users.doc(doc._id).update({
                data: {
                    pointsBalance: 0,
                    updatedAt: Date.now(),
                },
            });
            updated += 1;
        }
        if (docs.length < 100) {
            break;
        }
    }
    return updated;
}
async function main(event = {}) {
    if (event.action === 'invite-rewards') {
        return resetInviteRewards(event);
    }
    if (event.confirm !== CONFIRM_TEXT) {
        throw new Error(`危险操作需要确认参数 confirm="${CONFIRM_TEXT}"`);
    }
    const clearCollections = [
        ...DEFAULT_CLEAR_COLLECTIONS,
        ...(event.includeUsers ? ['users'] : []),
        ...(event.includeMemberPlans ? ['memberPlans'] : []),
        ...(event.includeProductTypes ? ['productTypes'] : []),
        ...(event.includeAiAccountEmailDomains ? ['aiAccountEmailDomains'] : []),
        ...(event.includeAppStoreCountries ? ['appstoreCountries'] : []),
    ];
    if (event.dryRun) {
        const counts = {};
        for (const name of clearCollections) {
            counts[constants_1.COLLECTIONS[name]] = await countCollection(name);
        }
        if (!event.includeUsers) {
            counts.userPointsToReset = await countCollection('users');
        }
        return (0, utils_1.ok)({
            dryRun: true,
            clearCollections: clearCollections.map((name) => constants_1.COLLECTIONS[name]),
            counts,
            seedMemberPlans: true,
            seedProductTypes: true,
            seedAiAccountEmailDomains: true,
            seedAppStoreCountries: true,
        });
    }
    const removed = {};
    for (const name of clearCollections) {
        removed[constants_1.COLLECTIONS[name]] = await clearCollection(name);
    }
    const resetUserPointsCount = event.includeUsers ? 0 : await resetUserPoints();
    const seededProductTypes = await (0, product_type_seed_1.seedProductTypes)();
    const seededAiAccountEmailDomains = await (0, ai_account_email_domain_1.seedAiAccountEmailDomains)();
    const seededAppStoreCountries = await (0, appstore_country_seed_1.seedAppStoreCountries)();
    const seededPlans = await (0, plan_seed_1.seedMemberPlans)();
    return (0, utils_1.ok)({
        success: true,
        removed,
        resetUserPointsCount,
        seededProductTypes,
        seededAiAccountEmailDomains,
        seededAppStoreCountries,
        seededPlans,
        includeUsers: Boolean(event.includeUsers),
        includeMemberPlans: Boolean(event.includeMemberPlans),
        includeProductTypes: Boolean(event.includeProductTypes),
        includeAiAccountEmailDomains: Boolean(event.includeAiAccountEmailDomains),
        includeAppStoreCountries: Boolean(event.includeAppStoreCountries),
    });
}
