"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const constants_1 = require("./shared/constants");
const db_1 = require("./shared/db");
const plan_seed_1 = require("./shared/plan-seed");
const utils_1 = require("./shared/utils");
const CONFIRM_TEXT = 'RESET_TEST_DATABASE';
const DEFAULT_CLEAR_COLLECTIONS = [
    'memberships',
    'orders',
    'deliveries',
    'inviteRelations',
    'pointsLedger',
    'emailVerificationCodes',
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
    if (event.confirm !== CONFIRM_TEXT) {
        throw new Error(`危险操作需要确认参数 confirm="${CONFIRM_TEXT}"`);
    }
    const clearCollections = [
        ...DEFAULT_CLEAR_COLLECTIONS,
        ...(event.includeUsers ? ['users'] : []),
        ...(event.includeMemberPlans ? ['memberPlans'] : []),
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
        });
    }
    const removed = {};
    for (const name of clearCollections) {
        removed[constants_1.COLLECTIONS[name]] = await clearCollection(name);
    }
    const resetUserPointsCount = event.includeUsers ? 0 : await resetUserPoints();
    const seededPlans = await (0, plan_seed_1.seedMemberPlans)();
    return (0, utils_1.ok)({
        success: true,
        removed,
        resetUserPointsCount,
        seededPlans,
        includeUsers: Boolean(event.includeUsers),
        includeMemberPlans: Boolean(event.includeMemberPlans),
    });
}
