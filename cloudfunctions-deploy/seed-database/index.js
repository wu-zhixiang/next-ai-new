"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const constants_1 = require("./shared/constants");
const utils_1 = require("./shared/utils");
const PLAN_SEED = [
    {
        productCode: constants_1.DEFAULT_PRODUCT_CODE,
        productName: constants_1.DEFAULT_PRODUCT_NAME,
        planCode: 'annual',
        planName: '年度会员',
        price: 0.01,
        durationDays: 365,
        autoRenewEnabled: false,
        status: 'on',
        sort: 1,
        description: '年度主力套餐，适合长期使用场景。',
        createdAt: 1746921600000,
        updatedAt: 1746921600000,
    },
    {
        productCode: constants_1.DEFAULT_PRODUCT_CODE,
        productName: constants_1.DEFAULT_PRODUCT_NAME,
        planCode: 'quarterly',
        planName: '季度会员',
        price: 0.01,
        durationDays: 90,
        autoRenewEnabled: false,
        status: 'on',
        sort: 2,
        description: '季度会员套餐，适合阶段性体验。',
        createdAt: 1746921600000,
        updatedAt: 1746921600000,
    },
    {
        productCode: constants_1.DEFAULT_PRODUCT_CODE,
        productName: constants_1.DEFAULT_PRODUCT_NAME,
        planCode: 'monthly',
        planName: '月度会员',
        price: 0.01,
        durationDays: 30,
        autoRenewEnabled: false,
        status: 'on',
        sort: 3,
        description: '月度短周期套餐，适合低门槛试用。',
        createdAt: 1746921600000,
        updatedAt: 1746921600000,
    },
];
async function main(event = {}) {
    if (event.dryRun) {
        return (0, utils_1.ok)({
            dryRun: true,
            plans: PLAN_SEED,
        });
    }
    const now = Date.now();
    for (const seed of PLAN_SEED) {
        const existing = await (0, db_1.collection)('memberPlans').where({ planCode: seed.planCode }).limit(1).get();
        const current = existing.data[0];
        if (current === null || current === void 0 ? void 0 : current._id) {
            await (0, db_1.collection)('memberPlans').doc(current._id).update({
                data: {
                    ...seed,
                    updatedAt: now,
                },
            });
            continue;
        }
        await (0, db_1.collection)('memberPlans').add({
            data: {
                ...seed,
                createdAt: now,
                updatedAt: now,
            },
        });
    }
    return (0, utils_1.ok)({
        success: true,
        seededPlans: PLAN_SEED.length,
    });
}
