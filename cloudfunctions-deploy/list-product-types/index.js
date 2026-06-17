"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
function toProductTypeView(record) {
    var _a;
    return {
        productCode: record.productCode,
        productName: record.productName,
        label: record.label,
        tag: record.tag,
        avatarUrl: record.avatarUrl,
        available: record.available,
        description: record.description,
        introHighlights: (_a = record.introHighlights) !== null && _a !== void 0 ? _a : [],
    };
}
async function main() {
    const result = await (0, db_1.collection)('productTypes')
        .where({ status: 'on' })
        .orderBy('sort', 'asc')
        .get();
    const productTypes = result.data.map(toProductTypeView);
    return (0, utils_1.ok)({ productTypes });
}
