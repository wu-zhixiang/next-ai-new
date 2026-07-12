"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.expireAiToolPointBuckets = expireAiToolPointBuckets;
exports.refreshAiToolPointsBalance = refreshAiToolPointsBalance;
exports.grantAiToolPointBucket = grantAiToolPointBucket;
exports.consumeAiToolPoints = consumeAiToolPoints;
exports.refundAiToolPoints = refundAiToolPoints;
const db_1 = require("./db");
const ai_tool_points_policy_1 = require("./ai-tool-points-policy");
let walletCollectionsReady = false;
async function ensureAiToolPointWalletCollections() {
    if (walletCollectionsReady) {
        return;
    }
    await Promise.all([
        (0, db_1.ensureCollection)('aiToolPointBuckets'),
        (0, db_1.ensureCollection)('aiToolPointsLedger'),
    ]);
    walletCollectionsReady = true;
}
function normalizeNonNegativeInteger(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}
function isUsableBucket(bucket, now) {
    return bucket.status === 'active'
        && normalizeNonNegativeInteger(bucket.pointsRemaining) > 0
        && (!bucket.expiresAt || bucket.expiresAt > now);
}
async function listUserPointBuckets(userId) {
    const result = await (0, db_1.collection)('aiToolPointBuckets').where({ userId }).get();
    return result.data;
}
async function setUserAiToolPointsBalance(userId, balance, now) {
    await (0, db_1.collection)('users').doc(userId).update({
        data: {
            aiToolPointsBalance: balance,
            updatedAt: now,
        },
    });
}
async function expireAiToolPointBuckets(userId, now) {
    await ensureAiToolPointWalletCollections();
    const buckets = await listUserPointBuckets(userId);
    const expiredBuckets = buckets.filter((bucket) => (bucket.status === 'active'
        && Boolean(bucket.expiresAt)
        && Number(bucket.expiresAt) <= now
        && normalizeNonNegativeInteger(bucket.pointsRemaining) > 0));
    if (expiredBuckets.length === 0) {
        return 0;
    }
    let expiredPoints = 0;
    for (const bucket of expiredBuckets) {
        const points = normalizeNonNegativeInteger(bucket.pointsRemaining);
        expiredPoints += points;
        await (0, db_1.collection)('aiToolPointBuckets').doc(bucket._id).update({
            data: {
                pointsRemaining: 0,
                status: 'expired',
                updatedAt: now,
            },
        });
    }
    return expiredPoints;
}
async function refreshAiToolPointsBalance(userId, now = Date.now()) {
    await ensureAiToolPointWalletCollections();
    const expiredPoints = await expireAiToolPointBuckets(userId, now);
    const buckets = await listUserPointBuckets(userId);
    const balance = buckets
        .filter((bucket) => isUsableBucket(bucket, now))
        .reduce((total, bucket) => total + normalizeNonNegativeInteger(bucket.pointsRemaining), 0);
    await setUserAiToolPointsBalance(userId, balance, now);
    if (expiredPoints > 0) {
        const user = await (0, db_1.getUserById)(userId);
        const ledger = {
            userId,
            openid: user === null || user === void 0 ? void 0 : user.openid,
            type: 'points_expire',
            direction: 'out',
            points: expiredPoints,
            balanceAfter: balance,
            description: `套餐积分到期失效${expiredPoints}积分`,
            createdAt: now,
        };
        await (0, db_1.collection)('aiToolPointsLedger').add({ data: ledger });
    }
    return balance;
}
async function grantAiToolPointBucket(input) {
    await ensureAiToolPointWalletCollections();
    const points = normalizeNonNegativeInteger(input.points);
    if (points <= 0) {
        return {
            bucketId: '',
            balanceAfter: await refreshAiToolPointsBalance(input.userId, input.now),
        };
    }
    const record = {
        userId: input.userId,
        openid: input.openid,
        sourceType: input.sourceType,
        orderNo: input.orderNo,
        relatedUserId: input.relatedUserId,
        milestoneKey: input.milestoneKey,
        pointsTotal: points,
        pointsRemaining: points,
        expiresAt: input.expiresAt,
        status: 'active',
        createdAt: input.now,
        updatedAt: input.now,
    };
    const result = await (0, db_1.collection)('aiToolPointBuckets').add({ data: record });
    const balanceAfter = await refreshAiToolPointsBalance(input.userId, input.now);
    return {
        bucketId: result._id,
        balanceAfter,
    };
}
async function consumeAiToolPoints(params) {
    await ensureAiToolPointWalletCollections();
    const points = normalizeNonNegativeInteger(params.points);
    const balance = await refreshAiToolPointsBalance(params.user._id, params.now);
    if (points <= 0) {
        return {
            ok: true,
            points: 0,
            balanceAfter: balance,
            bucketDeductions: [],
        };
    }
    if (balance < points) {
        return {
            ok: false,
            balance,
        };
    }
    const buckets = await listUserPointBuckets(params.user._id);
    const bucketDeductions = (0, ai_tool_points_policy_1.planAiToolPointBucketDeductions)(buckets, points, params.now);
    const deductionTotal = bucketDeductions.reduce((total, item) => total + item.points, 0);
    if (deductionTotal < points) {
        return {
            ok: false,
            balance: await refreshAiToolPointsBalance(params.user._id, params.now),
        };
    }
    const bucketById = new Map(buckets.map((bucket) => [bucket._id, bucket]));
    for (const deduction of bucketDeductions) {
        const bucket = bucketById.get(deduction.bucketId);
        const nextRemaining = Math.max(0, normalizeNonNegativeInteger(bucket === null || bucket === void 0 ? void 0 : bucket.pointsRemaining) - deduction.points);
        await (0, db_1.collection)('aiToolPointBuckets').doc(deduction.bucketId).update({
            data: {
                pointsRemaining: db_1._.inc(-deduction.points),
                status: nextRemaining > 0 ? 'active' : 'used_up',
                updatedAt: params.now,
            },
        });
    }
    return {
        ok: true,
        points,
        balanceAfter: await refreshAiToolPointsBalance(params.user._id, params.now),
        bucketDeductions,
    };
}
async function refundAiToolPoints(params) {
    await ensureAiToolPointWalletCollections();
    for (const deduction of params.bucketDeductions) {
        const bucketResult = await (0, db_1.collection)('aiToolPointBuckets').doc(deduction.bucketId).get();
        const bucket = bucketResult.data;
        if (!bucket) {
            continue;
        }
        const expired = Boolean(bucket.expiresAt) && Number(bucket.expiresAt) <= params.now;
        if (expired) {
            await (0, db_1.collection)('aiToolPointBuckets').doc(deduction.bucketId).update({
                data: {
                    status: 'expired',
                    updatedAt: params.now,
                },
            });
            continue;
        }
        const nextRemaining = normalizeNonNegativeInteger(bucket.pointsRemaining) + normalizeNonNegativeInteger(deduction.points);
        await (0, db_1.collection)('aiToolPointBuckets').doc(deduction.bucketId).update({
            data: {
                pointsRemaining: db_1._.inc(normalizeNonNegativeInteger(deduction.points)),
                status: nextRemaining > 0 ? 'active' : bucket.status,
                updatedAt: params.now,
            },
        });
    }
    return refreshAiToolPointsBalance(params.user._id, params.now);
}
