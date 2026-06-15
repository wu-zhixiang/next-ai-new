"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const context_1 = require("./_lib/context");
const utils_1 = require("./shared/utils");
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
            if (membership.productCode) {
                purchasedProductCodes.add(membership.productCode);
            }
        });
        orders
            .filter((order) => order.payStatus === 'paid')
            .forEach((order) => {
            if (order.productCode) {
                purchasedProductCodes.add(order.productCode);
            }
        });
    }
    const productHasFirstBuyPlan = new Set(rawPlans
        .filter((plan) => Boolean(plan.isFirstBuy || plan.isFirstBay))
        .map((plan) => plan.productCode));
    const visiblePlans = rawPlans.filter((plan) => {
        const isFirstBuyPlan = Boolean(plan.isFirstBuy || plan.isFirstBay);
        const isFirstBuyer = !purchasedProductCodes.has(plan.productCode);
        if (isFirstBuyer && productHasFirstBuyPlan.has(plan.productCode)) {
            return isFirstBuyPlan;
        }
        if (!isFirstBuyer) {
            return !isFirstBuyPlan;
        }
        return true;
    });
    const plans = visiblePlans.map((item) => {
        const plan = item;
        return {
            productCode: plan.productCode,
            productName: plan.productName,
            planCode: plan.planCode,
            planName: plan.planName,
            isFirstBuy: Boolean(plan.isFirstBuy || plan.isFirstBay),
            isFirstBay: Boolean(plan.isFirstBay || plan.isFirstBuy),
            price: plan.price,
            durationDays: plan.durationDays,
            description: plan.description,
        };
    });
    return (0, utils_1.ok)({ plans });
}
