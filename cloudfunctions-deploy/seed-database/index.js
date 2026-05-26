"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const plan_seed_1 = require("./shared/plan-seed");
const utils_1 = require("./shared/utils");
async function main(event = {}) {
    if (event.dryRun) {
        return (0, utils_1.ok)({
            dryRun: true,
            plans: plan_seed_1.PLAN_SEED,
        });
    }
    const seededPlans = await (0, plan_seed_1.seedMemberPlans)();
    return (0, utils_1.ok)({
        success: true,
        seededPlans,
    });
}
