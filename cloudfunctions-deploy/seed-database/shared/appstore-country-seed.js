"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPSTORE_COUNTRY_SEED = void 0;
exports.seedAppStoreCountries = seedAppStoreCountries;
const db_1 = require("./db");
const appstore_country_data_1 = require("./appstore-country-data");
var appstore_country_data_2 = require("./appstore-country-data");
Object.defineProperty(exports, "APPSTORE_COUNTRY_SEED", { enumerable: true, get: function () { return appstore_country_data_2.APPSTORE_COUNTRY_SEED; } });
async function seedAppStoreCountries(now = Date.now()) {
    await (0, db_1.ensureCollection)('appstoreCountries');
    for (const seed of appstore_country_data_1.APPSTORE_COUNTRY_SEED) {
        const existing = await (0, db_1.collection)('appstoreCountries').where({ countryCode: seed.countryCode }).limit(1).get();
        const current = existing.data[0];
        if (current === null || current === void 0 ? void 0 : current._id) {
            await (0, db_1.collection)('appstoreCountries').doc(current._id).update({
                data: {
                    ...seed,
                    updatedAt: now,
                },
            });
            continue;
        }
        await (0, db_1.collection)('appstoreCountries').add({
            data: {
                ...seed,
                createdAt: now,
                updatedAt: now,
            },
        });
    }
    return appstore_country_data_1.APPSTORE_COUNTRY_SEED.length;
}
