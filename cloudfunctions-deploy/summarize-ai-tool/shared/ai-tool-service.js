"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeAiTool = executeAiTool;
exports.getAiToolRun = getAiToolRun;
const node_crypto_1 = require("node:crypto");
const constants_1 = require("./constants");
const db_1 = require("./db");
const ai_tool_generation_1 = require("./ai-tool-generation");
const ai_tool_core_1 = require("./ai-tool-core");
let aiToolCollectionsReady = false;
async function ensureAiToolCollections() {
    if (aiToolCollectionsReady) {
        return;
    }
    await Promise.all([
        (0, db_1.ensureCollection)('aiToolRuns'),
        (0, db_1.ensureCollection)('aiToolUsageDaily'),
    ]);
    aiToolCollectionsReady = true;
}
function isActiveToolMembership(membership, now) {
    if (!membership) {
        return false;
    }
    if (membership.status === 'opening') {
        return true;
    }
    return membership.status === 'active' && membership.endAt > now;
}
function createInputDigest(input) {
    return (0, node_crypto_1.createHash)('sha256')
        .update(input.toolId)
        .update('\n')
        .update(input.outputType)
        .update('\n')
        .update(input.text)
        .update('\n')
        .update(input.fileText)
        .update('\n')
        .update(input.imageDataUrl)
        .digest('hex');
}
async function getDailyUsage(userId, date) {
    var _a;
    const result = await (0, db_1.collection)('aiToolUsageDaily').where({ userId, date }).limit(1).get();
    return (_a = result.data[0]) !== null && _a !== void 0 ? _a : null;
}
async function recordUsage(userId, date, usage, now) {
    const freeIncrement = usage.freeUsed ? 1 : 0;
    const adIncrement = usage.rewardAdUsed ? 1 : 0;
    const memberIncrement = usage.memberUsed ? 1 : 0;
    const existing = await getDailyUsage(userId, date);
    if (!existing) {
        const record = {
            userId,
            date,
            freeUsed: freeIncrement,
            adUnlocked: adIncrement,
            memberUsed: memberIncrement,
            updatedAt: now,
        };
        await (0, db_1.collection)('aiToolUsageDaily').add({ data: record });
        return;
    }
    await (0, db_1.collection)('aiToolUsageDaily').doc(existing._id).update({
        data: {
            freeUsed: db_1._.inc(freeIncrement),
            adUnlocked: db_1._.inc(adIncrement),
            memberUsed: db_1._.inc(memberIncrement),
            updatedAt: now,
        },
    });
}
function toRunResult(record) {
    var _a;
    return {
        runId: record._id,
        status: record.status,
        toolId: record.toolId,
        title: record.title || (record.status === 'failed' ? '生成失败' : '结果处理中'),
        summary: record.summary,
        points: record.points,
        outputText: record.outputText,
        outputImages: record.outputImages,
        usage: (_a = record.usage) !== null && _a !== void 0 ? _a : {
            charged: false,
            freeUsed: false,
            rewardAdUsed: false,
            memberUsed: false,
            dailyFreeLimit: 1,
            dailyFreeRemaining: 0,
        },
        createdAt: record.createdAt,
    };
}
async function createProcessingRun(params) {
    const record = {
        userId: params.user._id,
        openid: params.user.openid,
        toolId: params.input.toolId,
        outputType: params.input.outputType,
        source: params.input.source,
        status: 'processing',
        inputDigest: createInputDigest(params.input),
        assetIds: params.input.assetIds,
        createdAt: params.now,
        updatedAt: params.now,
    };
    const result = await (0, db_1.collection)('aiToolRuns').add({ data: record });
    return result._id;
}
async function markRunSucceeded(params) {
    await (0, db_1.collection)('aiToolRuns').doc(params.runId).update({
        data: {
            status: 'succeeded',
            title: params.textResult.title,
            summary: params.textResult.summary,
            points: params.textResult.points,
            outputText: params.textResult.outputText,
            usage: params.usage,
            modelProvider: params.modelProvider,
            modelName: params.modelName,
            updatedAt: params.now,
        },
    });
}
async function markRunFailed(params) {
    await (0, db_1.collection)('aiToolRuns').doc(params.runId).update({
        data: {
            status: 'failed',
            title: '生成失败',
            summary: params.message,
            points: [],
            outputText: params.message,
            errorCode: params.code,
            errorMessage: params.message,
            modelProvider: params.modelProvider,
            modelName: params.modelName,
            updatedAt: params.now,
        },
    });
}
async function executeAiTool(event, openid) {
    var _a, _b;
    const normalized = (0, ai_tool_core_1.normalizeRunAiToolInput)(event);
    if (normalized.ok === false) {
        return {
            ok: false,
            code: normalized.code,
            message: normalized.message,
        };
    }
    await ensureAiToolCollections();
    const now = Date.now();
    const user = await (0, db_1.getUserByOpenId)(openid);
    if (!user) {
        return {
            ok: false,
            code: 'UNAUTHENTICATED',
            message: '请先登录后再使用',
        };
    }
    const [membership, usageRecord] = await Promise.all([
        (0, db_1.getMembershipByUserId)(user._id, constants_1.DEFAULT_PRODUCT_CODE),
        getDailyUsage(user._id, (0, ai_tool_core_1.getAiToolUsageDateKey)(now)),
    ]);
    const entitlement = (0, ai_tool_core_1.resolveAiToolEntitlement)({
        isMember: isActiveToolMembership(membership, now),
        freeUsedToday: (_a = usageRecord === null || usageRecord === void 0 ? void 0 : usageRecord.freeUsed) !== null && _a !== void 0 ? _a : 0,
        rewardAdUnlocked: normalized.input.rewardAdUnlocked,
    });
    if (entitlement.allowed === false) {
        return {
            ok: false,
            code: entitlement.code,
            message: entitlement.message,
        };
    }
    const runId = await createProcessingRun({
        user,
        input: normalized.input,
        now,
    });
    const generated = await (0, ai_tool_generation_1.generateAiToolText)(normalized.input);
    const textResult = (_b = generated.result) !== null && _b !== void 0 ? _b : (normalized.input.imageDataUrl
        ? null
        : (0, ai_tool_generation_1.fallbackTextResult)((0, ai_tool_generation_1.buildAiToolContent)(normalized.input), normalized.input.outputType));
    const completedAt = Date.now();
    if (!textResult) {
        const message = generated.errorMessage.includes('CloudBase AI SDK unavailable')
            ? `AI 模型服务不可用：${generated.errorMessage}`
            : `参考素材解析失败：${generated.errorMessage || '请更换素材或补充文字描述'}`;
        await markRunFailed({
            runId,
            code: 'MODEL_FAILED',
            message,
            modelProvider: generated.modelProvider,
            modelName: generated.modelName,
            now: completedAt,
        });
        return {
            ok: false,
            code: 'MODEL_FAILED',
            message,
        };
    }
    const usage = {
        ...entitlement.usage,
        model: generated.modelName,
    };
    await recordUsage(user._id, (0, ai_tool_core_1.getAiToolUsageDateKey)(completedAt), usage, completedAt);
    await markRunSucceeded({
        runId,
        textResult,
        usage,
        modelProvider: generated.modelProvider,
        modelName: generated.modelName,
        now: completedAt,
    });
    return {
        ok: true,
        data: {
            result: {
                runId,
                status: 'succeeded',
                toolId: normalized.input.toolId,
                title: textResult.title,
                summary: textResult.summary,
                points: textResult.points,
                outputText: textResult.outputText,
                usage,
                createdAt: now,
            },
            textResult,
        },
    };
}
async function getAiToolRun(runId, openid) {
    await ensureAiToolCollections();
    const normalizedRunId = String(runId || '').trim();
    if (!normalizedRunId) {
        return {
            ok: false,
            code: 'INVALID_INPUT',
            message: '缺少执行 ID',
        };
    }
    const user = await (0, db_1.getUserByOpenId)(openid);
    if (!user) {
        return {
            ok: false,
            code: 'UNAUTHENTICATED',
            message: '请先登录后再使用',
        };
    }
    try {
        const result = await (0, db_1.collection)('aiToolRuns').doc(normalizedRunId).get();
        const record = result.data;
        if (!record || record.userId !== user._id) {
            return {
                ok: false,
                code: 'NOT_FOUND',
                message: '未找到该执行结果',
            };
        }
        return {
            ok: true,
            data: toRunResult({ ...record, _id: normalizedRunId }),
        };
    }
    catch (_a) {
        return {
            ok: false,
            code: 'NOT_FOUND',
            message: '未找到该执行结果',
        };
    }
}
