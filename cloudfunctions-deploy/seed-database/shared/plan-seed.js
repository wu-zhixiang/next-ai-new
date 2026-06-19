"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_SEED = void 0;
exports.seedMemberPlans = seedMemberPlans;
exports.seedPlanComplianceDisplays = seedPlanComplianceDisplays;
const constants_1 = require("./constants");
const db_1 = require("./db");
const SEED_TIME = 1746921600000;
function generatePlanPid(productCode, planCode) {
    return `${productCode}_${planCode}`.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase();
}
const PLAN_SEED_SOURCE = [
    {
        productCode: constants_1.DEFAULT_PRODUCT_CODE,
        productName: 'ChatGPT Plus',
        planCode: 'plus',
        planName: 'ChatGPT Plus',
        virtualPaymentProductId: 'chatgpt_plus',
        price: 160,
        durationDays: 30,
        autoRenewEnabled: false,
        status: 'on',
        sort: 1,
        description: 'ChatGPT Plus 月度会员套餐。',
        complianceDisplay: {
            productName: 'AI效率会员',
            planName: 'AI效率会员月度套餐',
            description: 'AI效率服务月度套餐。',
        },
    },
    {
        productCode: constants_1.DEFAULT_PRODUCT_CODE,
        productName: 'ChatGPT Plus',
        planCode: 'quarterly',
        planName: 'ChatGPT Plus 季度会员',
        virtualPaymentProductId: 'chatgpt_qtr',
        price: 460,
        durationDays: 90,
        autoRenewEnabled: false,
        status: 'on',
        sort: 2,
        description: 'ChatGPT Plus 季度会员套餐。',
        complianceDisplay: {
            productName: 'AI效率会员',
            planName: 'AI效率会员季度套餐',
            description: 'AI效率服务季度套餐。',
        },
    },
    {
        productCode: 'claude_pro',
        productName: 'Claude Pro',
        planCode: 'pro',
        planName: 'Claude Pro',
        virtualPaymentProductId: 'claude_pro',
        price: 128,
        durationDays: 30,
        autoRenewEnabled: false,
        status: 'on',
        sort: 3,
        description: 'Claude Pro 月度会员套餐。',
        complianceDisplay: {
            productName: 'AI创作会员',
            planName: 'AI创作会员月度套餐',
            description: 'AI创作服务月度套餐。',
        },
    },
];
exports.PLAN_SEED = PLAN_SEED_SOURCE.map((seed) => ({
    ...seed,
    pid: generatePlanPid(seed.productCode, seed.planCode),
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
}));
async function seedMemberPlans(now = Date.now()) {
    await (0, db_1.ensureCollection)('memberPlans');
    const plans = (0, db_1.collection)('memberPlans');
    const targetPids = new Set(exports.PLAN_SEED.map((seed) => seed.pid));
    const currentPlans = (await plans.get()).data;
    for (const plan of currentPlans) {
        if (plan._id && (!plan.pid || !targetPids.has(plan.pid))) {
            await plans.doc(plan._id).remove();
        }
    }
    for (const seed of exports.PLAN_SEED) {
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
    return exports.PLAN_SEED.length;
}
async function seedPlanComplianceDisplays(now = Date.now()) {
    await (0, db_1.ensureCollection)('memberPlans');
    const plans = (0, db_1.collection)('memberPlans');
    let updated = 0;
    for (const seed of exports.PLAN_SEED) {
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
