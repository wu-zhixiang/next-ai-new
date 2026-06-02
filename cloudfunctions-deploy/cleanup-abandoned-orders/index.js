"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.main = main;
const order_cleanup_1 = require("./shared/order-cleanup");
const utils_1 = require("./shared/utils");
async function main() {
    const result = await (0, order_cleanup_1.cleanupAbandonedOrders)();
    return (0, utils_1.ok)(result);
}
