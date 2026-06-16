"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const context_1 = require("./_lib/context");
const utils_1 = require("./shared/utils");
const constants_1 = require("./shared/constants");
function normalizePurchasedProductCode(record) {
    return record.productCode || constants_1.DEFAULT_PRODUCT_CODE;
}
function isFirstBuyPlan(plan) {
    return normalizeBooleanFlag(plan.isFirstBuy);
}
function normalizeBooleanFlag(value) {
    if (value === true || value === 1) {
        return true;
    }
    if (typeof value === 'string') {
        return value.trim().toLowerCase() === 'true' || value.trim() === '1';
    }
    return false;
}
async function main(event = {}) {
    const { OPENID } = (0, context_1.getWxContext)();
    const user = await (0, db_1.getUserByOpenId)(OPENID);
    const query = event.productCode ? { status: 'on', productCode: event.productCode } : { status: 'on' };
    const result = await (0, db_1.collection)('memberPlans')
        .where(query)
        .orderBy('sort', 'asc')
        .get();
    const rawPlans = result.data;
    const purchasedProductCodes = new Set();
    if (user === null || user === void 0 ? void 0 : user._id) {
        const [memberships, orders] = await Promise.all([
            (0, db_1.listMembershipsByUserId)(user._id),
            (0, db_1.listOrdersByUserId)(user._id),
        ]);
        memberships.forEach((membership) => {
            purchasedProductCodes.add(normalizePurchasedProductCode(membership));
        });
        orders
            .filter((order) => order.payStatus === 'paid')
            .forEach((order) => {
            purchasedProductCodes.add(normalizePurchasedProductCode(order));
        });
    }
    const productHasFirstBuyPlan = new Set(rawPlans
        .filter(isFirstBuyPlan)
        .map((plan) => plan.productCode));
    const visiblePlans = rawPlans.filter((plan) => {
        const firstBuyPlan = isFirstBuyPlan(plan);
        const isFirstBuyer = !purchasedProductCodes.has(plan.productCode);
        if (isFirstBuyer && productHasFirstBuyPlan.has(plan.productCode)) {
            return firstBuyPlan;
        }
        if (!isFirstBuyer) {
            return !firstBuyPlan;
        }
        return true;
    });
    const plans = visiblePlans.map((item) => {
        const plan = item;
        return {
            pid: plan.pid,
            productCode: plan.productCode,
            productName: plan.productName,
            planCode: plan.planCode,
            planName: plan.planName,
            isFirstBuy: isFirstBuyPlan(plan),
            price: plan.price,
            durationDays: plan.durationDays,
            description: plan.description,
        };
    });
    return (0, utils_1.ok)({ plans });
}
