"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
async function main(event = {}) {
    const query = event.productCode ? { status: 'on', productCode: event.productCode } : { status: 'on' };
    const result = await (0, db_1.collection)('memberPlans')
        .where(query)
        .orderBy('sort', 'asc')
        .get();
    const plans = result.data.map((item) => {
        const plan = item;
        return {
            productCode: plan.productCode,
            productName: plan.productName,
            planCode: plan.planCode,
            planName: plan.planName,
            price: plan.price,
            durationDays: plan.durationDays,
            description: plan.description,
        };
    });
    return (0, utils_1.ok)({ plans });
}
