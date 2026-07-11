"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEffectiveAiToolConfig = getEffectiveAiToolConfig;
exports.reserveAiToolUsage = reserveAiToolUsage;
exports.releaseAiToolUsageReservation = releaseAiToolUsageReservation;
exports.grantAiToolPlanPointsOnce = grantAiToolPlanPointsOnce;
exports.grantSingleToolEntitlementOnce = grantSingleToolEntitlementOnce;
const db_1 = require("./db");
const ai_tool_config_1 = require("./ai-tool-config");
let collectionsReady = false;
async function ensureAiToolEntitlementCollections() {
    if (collectionsReady) {
        return;
    }
    await Promise.all([
        (0, db_1.ensureCollection)('aiToolUserUsage'),
        (0, db_1.ensureCollection)('aiToolPointsLedger'),
        (0, db_1.ensureCollection)('aiToolSingleEntitlements'),
    ]);
    collectionsReady = true;
}
function normalizeNonNegativeInteger(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}
async function getToolOverride(toolId) {
    try {
        await (0, db_1.ensureCollection)('aiTools');
        const result = await (0, db_1.collection)('aiTools')
            .where({ toolId })
            .limit(1)
            .get();
        return result.data[0];
    }
    catch (_a) {
        return undefined;
    }
}
async function getEffectiveAiToolConfig(toolId) {
    var _a, _b;
    const definition = (0, ai_tool_config_1.getDefaultAdminToolDefinitions)().find((item) => item.toolId === toolId);
    if (!definition) {
        return null;
    }
    const base = (0, ai_tool_config_1.buildDefaultAiToolRecord)(definition);
    const override = await getToolOverride(toolId);
    if (override === null || override === void 0 ? void 0 : override.deleted) {
        return {
            toolId,
            name: override.name || base.name,
            enabled: false,
            status: 'disabled',
            pointCost: normalizeNonNegativeInteger((_a = override.pointCost) !== null && _a !== void 0 ? _a : base.pointCost),
            trialLimit: normalizeNonNegativeInteger((_b = override.trialLimit) !== null && _b !== void 0 ? _b : base.trialLimit),
        };
    }
    const merged = override ? { ...base, ...override, toolId } : base;
    const status = (0, ai_tool_config_1.normalizeToolConfigStatus)(merged.status);
    return {
        toolId,
        name: merged.cardTitle || merged.name,
        enabled: status === 'enabled',
        status,
        pointCost: normalizeNonNegativeInteger(merged.pointCost),
        trialLimit: normalizeNonNegativeInteger(merged.trialLimit),
    };
}
async function getUsageRecord(userId, toolId) {
    var _a;
    await ensureAiToolEntitlementCollections();
    const result = await (0, db_1.collection)('aiToolUserUsage')
        .where({ userId, toolId })
        .limit(1)
        .get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function createUsageRecord(user, toolId, now) {
    const record = {
        userId: user._id,
        openid: user.openid,
        toolId,
        trialUsed: 0,
        consumeCount: 0,
        createdAt: now,
        updatedAt: now,
    };
    const result = await (0, db_1.collection)('aiToolUserUsage').add({ data: record });
    return { ...record, _id: result._id };
}
async function getOrCreateUsageRecord(user, toolId, now) {
    var _a;
    return (_a = await getUsageRecord(user._id, toolId)) !== null && _a !== void 0 ? _a : await createUsageRecord(user, toolId, now);
}
async function findAvailableSingleEntitlement(userId, toolId) {
    var _a;
    await ensureAiToolEntitlementCollections();
    const result = await (0, db_1.collection)('aiToolSingleEntitlements')
        .where({ userId, toolId, status: 'available' })
        .limit(1)
        .get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function reserveAiToolUsage(params) {
    await ensureAiToolEntitlementCollections();
    const usage = await getOrCreateUsageRecord(params.user, params.tool.toolId, params.now);
    if (usage.trialUsed < params.tool.trialLimit) {
        await (0, db_1.collection)('aiToolUserUsage').doc(usage._id).update({
            data: {
                trialUsed: db_1._.inc(1),
                consumeCount: db_1._.inc(1),
                updatedAt: params.now,
            },
        });
        return {
            ok: true,
            mode: 'trial',
            pointCost: params.tool.pointCost,
            trialLimit: params.tool.trialLimit,
            trialRemaining: Math.max(0, params.tool.trialLimit - usage.trialUsed - 1),
        };
    }
    const entitlement = await findAvailableSingleEntitlement(params.user._id, params.tool.toolId);
    if (entitlement) {
        await (0, db_1.collection)('aiToolSingleEntitlements').doc(entitlement._id).update({
            data: {
                status: 'used',
                usedRunId: params.runId,
                usedAt: params.now,
                updatedAt: params.now,
            },
        });
        await (0, db_1.collection)('aiToolUserUsage').doc(usage._id).update({
            data: {
                consumeCount: db_1._.inc(1),
                updatedAt: params.now,
            },
        });
        return {
            ok: true,
            mode: 'single',
            pointCost: params.tool.pointCost,
            trialLimit: params.tool.trialLimit,
            trialRemaining: 0,
            singleEntitlementId: entitlement._id,
        };
    }
    const balance = normalizeNonNegativeInteger(params.user.aiToolPointsBalance);
    if (balance < params.tool.pointCost) {
        return {
            ok: false,
            code: 'QUOTA_EXCEEDED',
            message: 'AI工具积分不足',
            pointCost: params.tool.pointCost,
            balance,
            singlePurchaseAmount: Number((params.tool.pointCost / 10).toFixed(2)),
        };
    }
    await (0, db_1.collection)('users').doc(params.user._id).update({
        data: {
            aiToolPointsBalance: db_1._.inc(-params.tool.pointCost),
            updatedAt: params.now,
        },
    });
    const refreshedUser = await (0, db_1.getUserById)(params.user._id);
    const ledger = {
        userId: params.user._id,
        openid: params.user.openid,
        toolId: params.tool.toolId,
        runId: params.runId,
        type: 'tool_consume',
        direction: 'out',
        points: params.tool.pointCost,
        balanceAfter: refreshedUser === null || refreshedUser === void 0 ? void 0 : refreshedUser.aiToolPointsBalance,
        description: `使用${params.tool.name}消耗${params.tool.pointCost}积分`,
        createdAt: params.now,
    };
    await (0, db_1.collection)('aiToolPointsLedger').add({ data: ledger });
    await (0, db_1.collection)('aiToolUserUsage').doc(usage._id).update({
        data: {
            consumeCount: db_1._.inc(1),
            updatedAt: params.now,
        },
    });
    return {
        ok: true,
        mode: 'points',
        pointCost: params.tool.pointCost,
        trialLimit: params.tool.trialLimit,
        trialRemaining: 0,
        balanceAfter: refreshedUser === null || refreshedUser === void 0 ? void 0 : refreshedUser.aiToolPointsBalance,
    };
}
async function releaseAiToolUsageReservation(params) {
    await ensureAiToolEntitlementCollections();
    const usage = await getUsageRecord(params.user._id, params.tool.toolId);
    if (usage) {
        await (0, db_1.collection)('aiToolUserUsage').doc(usage._id).update({
            data: {
                ...(params.charge.mode === 'trial' ? { trialUsed: db_1._.inc(-1) } : {}),
                consumeCount: db_1._.inc(-1),
                updatedAt: params.now,
            },
        });
    }
    if (params.charge.mode === 'single' && params.charge.singleEntitlementId) {
        await (0, db_1.collection)('aiToolSingleEntitlements').doc(params.charge.singleEntitlementId).update({
            data: {
                status: 'available',
                usedRunId: '',
                usedAt: 0,
                updatedAt: params.now,
            },
        });
        return;
    }
    if (params.charge.mode !== 'points' || params.charge.pointCost <= 0) {
        return;
    }
    await (0, db_1.collection)('users').doc(params.user._id).update({
        data: {
            aiToolPointsBalance: db_1._.inc(params.charge.pointCost),
            updatedAt: params.now,
        },
    });
    const refreshedUser = await (0, db_1.getUserById)(params.user._id);
    const ledger = {
        userId: params.user._id,
        openid: params.user.openid,
        toolId: params.tool.toolId,
        runId: params.runId,
        type: 'adjustment',
        direction: 'in',
        points: params.charge.pointCost,
        balanceAfter: refreshedUser === null || refreshedUser === void 0 ? void 0 : refreshedUser.aiToolPointsBalance,
        description: `${params.tool.name}生成失败退回${params.charge.pointCost}积分`,
        createdAt: params.now,
    };
    await (0, db_1.collection)('aiToolPointsLedger').add({ data: ledger });
}
async function grantAiToolPlanPointsOnce(order, paidAt) {
    await ensureAiToolEntitlementCollections();
    const points = normalizeNonNegativeInteger(order.totalAiPoints);
    if (points <= 0 || order.orderType === 'tool_single') {
        return;
    }
    const existing = await (0, db_1.collection)('aiToolPointsLedger')
        .where({ userId: order.userId, orderNo: order.orderNo, type: 'plan_grant' })
        .limit(1)
        .get();
    if (existing.data[0]) {
        return;
    }
    await (0, db_1.collection)('users').doc(order.userId).update({
        data: {
            aiToolPointsBalance: db_1._.inc(points),
            updatedAt: paidAt,
        },
    });
    const user = await (0, db_1.getUserById)(order.userId);
    const ledger = {
        userId: order.userId,
        openid: user === null || user === void 0 ? void 0 : user.openid,
        orderNo: order.orderNo,
        type: 'plan_grant',
        direction: 'in',
        points,
        balanceAfter: user === null || user === void 0 ? void 0 : user.aiToolPointsBalance,
        description: `购买${order.planName}发放${points}AI工具积分`,
        createdAt: paidAt,
    };
    await (0, db_1.collection)('aiToolPointsLedger').add({ data: ledger });
}
async function grantSingleToolEntitlementOnce(order, paidAt) {
    await ensureAiToolEntitlementCollections();
    if (order.orderType !== 'tool_single' || !order.toolId) {
        return;
    }
    const user = await (0, db_1.getUserById)(order.userId);
    if (!(user === null || user === void 0 ? void 0 : user.openid)) {
        return;
    }
    const existingEntitlement = await (0, db_1.collection)('aiToolSingleEntitlements')
        .where({ userId: order.userId, orderNo: order.orderNo, toolId: order.toolId })
        .limit(1)
        .get();
    if (!existingEntitlement.data[0]) {
        const entitlement = {
            userId: order.userId,
            openid: user.openid,
            toolId: order.toolId,
            orderNo: order.orderNo,
            status: 'available',
            createdAt: paidAt,
            updatedAt: paidAt,
        };
        await (0, db_1.collection)('aiToolSingleEntitlements').add({ data: entitlement });
    }
    const existingLedger = await (0, db_1.collection)('aiToolPointsLedger')
        .where({ userId: order.userId, orderNo: order.orderNo, type: 'single_purchase' })
        .limit(1)
        .get();
    if (existingLedger.data[0]) {
        return;
    }
    const ledger = {
        userId: order.userId,
        openid: user.openid,
        toolId: order.toolId,
        orderNo: order.orderNo,
        type: 'single_purchase',
        direction: 'in',
        points: normalizeNonNegativeInteger(order.toolPointCost),
        balanceAfter: user.aiToolPointsBalance,
        description: `单次购买${order.toolName || order.toolId}使用权益`,
        createdAt: paidAt,
    };
    await (0, db_1.collection)('aiToolPointsLedger').add({ data: ledger });
}
