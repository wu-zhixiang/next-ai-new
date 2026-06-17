"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
function toAppStoreCountryView(record) {
    return {
        countryCode: record.countryCode,
        countryName: record.countryName,
        dialingCode: record.dialingCode,
        available: record.available,
    };
}
async function main() {
    const result = await (0, db_1.collection)('appstoreCountries')
        .where({ status: 'on' })
        .orderBy('sort', 'asc')
        .get();
    const countries = result.data.map(toAppStoreCountryView);
    return (0, utils_1.ok)({ countries });
}
