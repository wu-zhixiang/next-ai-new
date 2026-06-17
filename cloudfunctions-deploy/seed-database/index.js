"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const plan_seed_1 = require("./shared/plan-seed");
const appstore_country_seed_1 = require("./shared/appstore-country-seed");
const product_type_seed_1 = require("./shared/product-type-seed");
const utils_1 = require("./shared/utils");
async function main(event = {}) {
    if (event.dryRun) {
        return (0, utils_1.ok)({
            dryRun: true,
            productTypes: product_type_seed_1.PRODUCT_TYPE_SEED,
            appStoreCountries: appstore_country_seed_1.APPSTORE_COUNTRY_SEED,
            plans: plan_seed_1.PLAN_SEED,
        });
    }
    const seededProductTypes = await (0, product_type_seed_1.seedProductTypes)();
    const seededAppStoreCountries = await (0, appstore_country_seed_1.seedAppStoreCountries)();
    const seededPlans = await (0, plan_seed_1.seedMemberPlans)();
    return (0, utils_1.ok)({
        success: true,
        seededProductTypes,
        seededAppStoreCountries,
        seededPlans,
    });
}
