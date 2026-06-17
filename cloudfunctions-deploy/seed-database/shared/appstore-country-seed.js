"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPSTORE_COUNTRY_SEED = void 0;
exports.seedAppStoreCountries = seedAppStoreCountries;
const db_1 = require("./db");
exports.APPSTORE_COUNTRY_SEED = [
    {
        countryCode: 'PH',
        countryName: '菲律宾',
        dialingCode: '+63',
        available: true,
        sort: 1,
        status: 'on',
        createdAt: 1746921600000,
        updatedAt: 1746921600000,
    },
    {
        countryCode: 'NG',
        countryName: '尼日利亚',
        dialingCode: '+234',
        available: true,
        sort: 2,
        status: 'on',
        createdAt: 1746921600000,
        updatedAt: 1746921600000,
    },
];
async function seedAppStoreCountries(now = Date.now()) {
    await (0, db_1.ensureCollection)('appstoreCountries');
    for (const seed of exports.APPSTORE_COUNTRY_SEED) {
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
    return exports.APPSTORE_COUNTRY_SEED.length;
}
