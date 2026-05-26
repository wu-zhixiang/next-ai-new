"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAN_SEED = void 0;
exports.seedMemberPlans = seedMemberPlans;
const constants_1 = require("./constants");
const db_1 = require("./db");
exports.PLAN_SEED = [
    {
        productCode: constants_1.DEFAULT_PRODUCT_CODE,
        productName: constants_1.DEFAULT_PRODUCT_NAME,
        planCode: 'plus',
        planName: 'AI资讯PLUS会员',
        price: 0.01,
        durationDays: 30,
        autoRenewEnabled: false,
        status: 'on',
        sort: 1,
        description: 'PLUS月度会员套餐，适合深度资讯订阅场景。',
        createdAt: 1746921600000,
        updatedAt: 1746921600000,
    },
    {
        productCode: constants_1.DEFAULT_PRODUCT_CODE,
        productName: constants_1.DEFAULT_PRODUCT_NAME,
        planCode: 'go',
        planName: 'AI资讯GO会员',
        price: 0.01,
        durationDays: 30,
        autoRenewEnabled: false,
        status: 'on',
        sort: 2,
        description: 'GO月度会员套餐，适合轻量资讯订阅场景。',
        createdAt: 1746921600000,
        updatedAt: 1746921600000,
    },
];
const LEGACY_PLAN_CODES = ['annual', 'quarterly', 'monthly'];
async function seedMemberPlans(now = Date.now()) {
    for (const planCode of LEGACY_PLAN_CODES) {
        const existing = await (0, db_1.collection)('memberPlans').where({ planCode }).limit(1).get();
        const current = existing.data[0];
        if (current === null || current === void 0 ? void 0 : current._id) {
            await (0, db_1.collection)('memberPlans').doc(current._id).update({
                data: {
                    status: 'off',
                    updatedAt: now,
                },
            });
        }
    }
    for (const seed of exports.PLAN_SEED) {
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
    return exports.PLAN_SEED.length;
}
