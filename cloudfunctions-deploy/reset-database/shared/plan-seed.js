"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_SEED = void 0;
exports.seedMemberPlans = seedMemberPlans;
exports.seedPlanComplianceDisplays = seedPlanComplianceDisplays;
const db_1 = require("./db");
const plan_seed_data_1 = require("./plan-seed-data");
var plan_seed_data_2 = require("./plan-seed-data");
Object.defineProperty(exports, "PLAN_SEED", { enumerable: true, get: function () { return plan_seed_data_2.PLAN_SEED; } });
async function seedMemberPlans(now = Date.now()) {
    await (0, db_1.ensureCollection)('memberPlans');
    const plans = (0, db_1.collection)('memberPlans');
    const targetPids = new Set(plan_seed_data_1.PLAN_SEED.map((seed) => seed.pid));
    const currentPlans = (await plans.get()).data;
    for (const plan of currentPlans) {
        if (plan._id && (!plan.pid || !targetPids.has(plan.pid))) {
            await plans.doc(plan._id).remove();
        }
    }
    for (const seed of plan_seed_data_1.PLAN_SEED) {
        const existing = await plans.where({ pid: seed.pid }).limit(1).get();
        const current = existing.data[0];
        if (current === null || current === void 0 ? void 0 : current._id) {
            await plans.doc(current._id).update({
                data: {
                    ...seed,
                    updatedAt: now,
                },
            });
            continue;
        }
        await plans.add({
            data: {
                ...seed,
                createdAt: now,
                updatedAt: now,
            },
        });
    }
    return plan_seed_data_1.PLAN_SEED.length;
}
async function seedPlanComplianceDisplays(now = Date.now()) {
    await (0, db_1.ensureCollection)('memberPlans');
    const plans = (0, db_1.collection)('memberPlans');
    let updated = 0;
    for (const seed of plan_seed_data_1.PLAN_SEED) {
        const existing = await plans.where({ pid: seed.pid }).limit(1).get();
        const current = existing.data[0];
        if (!(current === null || current === void 0 ? void 0 : current._id) || !seed.complianceDisplay)
            continue;
        await plans.doc(current._id).update({
            data: {
                complianceDisplay: seed.complianceDisplay,
                updatedAt: now,
            },
        });
        updated += 1;
    }
    return updated;
}
