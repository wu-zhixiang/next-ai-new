"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeAiTool = executeAiTool;
exports.getAiToolRun = getAiToolRun;
const node_crypto_1 = require("node:crypto");
const db_1 = require("./db");
const ai_tool_entitlements_1 = require("./ai-tool-entitlements");
const ai_tool_generation_1 = require("./ai-tool-generation");
const ai_tool_core_1 = require("./ai-tool-core");
let aiToolCollectionsReady = false;
async function ensureAiToolCollections() {
    if (aiToolCollectionsReady) {
        return;
    }
    await Promise.all([
        (0, db_1.ensureCollection)('aiToolRuns'),
    ]);
    aiToolCollectionsReady = true;
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
            dailyFreeLimit: 0,
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
    var _a;
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
    const toolConfig = await (0, ai_tool_entitlements_1.getEffectiveAiToolConfig)(normalized.input.toolId);
    if (!(toolConfig === null || toolConfig === void 0 ? void 0 : toolConfig.enabled)) {
        return {
            ok: false,
            code: 'TOOL_DISABLED',
            message: toolConfig ? '该工具正在接入中' : '该工具暂未开放',
        };
    }
    const runId = await createProcessingRun({
        user,
        input: normalized.input,
        now,
    });
    const charge = await (0, ai_tool_entitlements_1.reserveAiToolUsage)({
        user,
        tool: toolConfig,
        runId,
        now,
    });
    if (charge.ok === false) {
        await markRunFailed({
            runId,
            code: charge.code,
            message: charge.message,
            now: Date.now(),
        });
        return {
            ok: false,
            code: charge.code,
            message: charge.message,
            data: {
                code: charge.code,
                toolId: normalized.input.toolId,
                pointCost: charge.pointCost,
                aiToolPointsBalance: charge.balance,
                singlePurchaseAmount: charge.singlePurchaseAmount,
            },
        };
    }
    const generated = await (0, ai_tool_generation_1.generateAiToolText)(normalized.input);
    const textResult = (_a = generated.result) !== null && _a !== void 0 ? _a : (normalized.input.imageDataUrl
        ? null
        : (0, ai_tool_generation_1.fallbackTextResult)((0, ai_tool_generation_1.buildAiToolContent)(normalized.input), normalized.input.outputType));
    const completedAt = Date.now();
    if (!textResult) {
        const message = generated.errorMessage.includes('CloudBase AI SDK unavailable')
            ? `AI 模型服务不可用：${generated.errorMessage}`
            : `参考素材解析失败：${generated.errorMessage || '请更换素材或补充文字描述'}`;
        await (0, ai_tool_entitlements_1.releaseAiToolUsageReservation)({
            user,
            tool: toolConfig,
            charge,
            runId,
            now: completedAt,
        });
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
        charged: charge.mode !== 'trial',
        freeUsed: charge.mode === 'trial',
        rewardAdUsed: false,
        memberUsed: false,
        dailyFreeLimit: charge.trialLimit,
        dailyFreeRemaining: charge.trialRemaining,
        chargeMode: charge.mode,
        pointCost: charge.pointCost,
        aiToolPointsBalance: charge.balanceAfter,
        singlePurchaseAmount: Number((charge.pointCost / 10).toFixed(2)),
        model: generated.modelName,
    };
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
