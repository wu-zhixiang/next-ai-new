"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cleanupAbandonedOrders = cleanupAbandonedOrders;
const db_1 = require("./db");
const utils_1 = require("./utils");
const ABANDONED_ORDER_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
function getAbandonedAt(order) {
    var _a, _b;
    if (order.payStatus === 'closed' || order.payStatus === 'failed') {
        return (_b = (_a = order.closedAt) !== null && _a !== void 0 ? _a : order.updatedAt) !== null && _b !== void 0 ? _b : order.createdAt;
    }
    if (order.payStatus === 'pending' && order.fulfillmentStatus !== 'opening') {
        const lastPayAttemptAt = order.prepayId ? order.updatedAt : undefined;
        return (0, utils_1.getPendingOrderExpireAt)(order.createdAt, order.payExpireAt, lastPayAttemptAt);
    }
    return null;
}
function shouldRemoveOrder(order, now) {
    if (order.payStatus === 'pending') {
        const lastPayAttemptAt = order.prepayId ? order.updatedAt : undefined;
        if (!(0, utils_1.isPendingOrderExpired)(order.createdAt, now, order.payExpireAt, lastPayAttemptAt)) {
            return false;
        }
    }
    const abandonedAt = getAbandonedAt(order);
    return Boolean(abandonedAt && now - abandonedAt >= ABANDONED_ORDER_RETENTION_MS);
}
async function cleanupAbandonedOrders(options = {}) {
    var _a;
    const now = (_a = options.now) !== null && _a !== void 0 ? _a : Date.now();
    const limit = Math.max(1, Math.min(options.limit || 100, 100));
    const query = options.userId ? { userId: options.userId } : {};
    let removed = 0;
    let scanned = 0;
    while (true) {
        const result = await (0, db_1.collection)('orders').where(query).skip(scanned).limit(limit).get();
        const orders = result.data;
        if (orders.length === 0) {
            break;
        }
        let batchRemoved = 0;
        for (const order of orders) {
            if (!order._id || !shouldRemoveOrder(order, now)) {
                continue;
            }
            await (0, db_1.collection)('orders').doc(order._id).remove();
            removed += 1;
            batchRemoved += 1;
        }
        if (batchRemoved === 0) {
            scanned += orders.length;
        }
        if (orders.length < limit) {
            break;
        }
    }
    return { removed };
}
