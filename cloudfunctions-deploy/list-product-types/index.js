"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const db_1 = require("./shared/db");
const utils_1 = require("./shared/utils");
function toProductTypeView(record) {
    var _a, _b;
    const complianceEnabled = (_a = record.complianceEnabled) !== null && _a !== void 0 ? _a : Boolean(record.complianceDisplay);
    return {
        productCode: record.productCode,
        productName: record.productName,
        label: record.label,
        tag: record.tag,
        avatarUrl: record.avatarUrl,
        detailPageUrl: record.detailPageUrl,
        available: record.available,
        description: record.description,
        introHighlights: (_b = record.introHighlights) !== null && _b !== void 0 ? _b : [],
        complianceEnabled,
        complianceDisplay: complianceEnabled ? record.complianceDisplay : undefined,
        fulfillmentMode: record.fulfillmentMode === 'manual' ? 'manual' : 'immediate',
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
