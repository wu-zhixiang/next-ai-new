"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planAiToolPointBucketDeductions = planAiToolPointBucketDeductions;
function normalizeNonNegativeInteger(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}
function isUsableBucket(bucket, now) {
    return bucket.status === 'active'
        && normalizeNonNegativeInteger(bucket.pointsRemaining) > 0
        && (!bucket.expiresAt || bucket.expiresAt > now);
}
function sortConsumableBuckets(left, right) {
    var _a, _b;
    const leftExpiresAt = (_a = left.expiresAt) !== null && _a !== void 0 ? _a : Number.MAX_SAFE_INTEGER;
    const rightExpiresAt = (_b = right.expiresAt) !== null && _b !== void 0 ? _b : Number.MAX_SAFE_INTEGER;
    if (leftExpiresAt !== rightExpiresAt) {
        return leftExpiresAt - rightExpiresAt;
    }
    return left.createdAt - right.createdAt;
}
function planAiToolPointBucketDeductions(buckets, points, now) {
    let remaining = normalizeNonNegativeInteger(points);
    if (remaining <= 0) {
        return [];
    }
    const deductions = [];
    for (const bucket of buckets.filter((item) => isUsableBucket(item, now)).sort(sortConsumableBuckets)) {
        if (remaining <= 0) {
            break;
        }
        const bucketPoints = normalizeNonNegativeInteger(bucket.pointsRemaining);
        const pointsFromBucket = Math.min(bucketPoints, remaining);
        if (pointsFromBucket <= 0) {
            continue;
        }
        deductions.push({
            bucketId: bucket._id,
            sourceType: bucket.sourceType,
            points: pointsFromBucket,
            expiresAt: bucket.expiresAt,
        });
        remaining -= pointsFromBucket;
    }
    return deductions;
}
