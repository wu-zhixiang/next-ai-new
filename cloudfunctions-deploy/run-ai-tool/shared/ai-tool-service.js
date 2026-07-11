"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeAiTool = executeAiTool;
exports.getAiToolRun = getAiToolRun;
exports.listAiToolRuns = listAiToolRuns;
exports.markAiToolImageRunSucceeded = markAiToolImageRunSucceeded;
exports.markAiToolImageRunFailed = markAiToolImageRunFailed;
const node_crypto_1 = require("node:crypto");
const db_1 = require("./db");
const ai_tool_entitlements_1 = require("./ai-tool-entitlements");
const points_rewards_1 = require("./points-rewards");
const ai_tool_generation_1 = require("./ai-tool-generation");
const ai_image_worker_1 = require("./ai-image-worker");
const ai_tool_core_1 = require("./ai-tool-core");
const AI_IMAGE_RUN_STALE_TIMEOUT_MS = 15 * 60 * 1000;
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
        .update('\n')
        .update(input.assetIds.join('\n'))
        .digest('hex');
}
async function toRunResult(record) {
    var _a;
    const outputImages = await hydrateOutputImages(record.outputImages);
    return {
        runId: record._id,
        status: record.status,
        toolId: record.toolId,
        title: record.title || (record.status === 'failed' ? '生成失败' : '结果处理中'),
        summary: record.summary,
        points: record.points,
        outputText: record.outputText,
        outputImages,
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
function isStaleImageRun(record, now = Date.now()) {
    return record.toolId === 'imageRepair'
        && record.status === 'processing'
        && now - (record.createdAt || record.updatedAt || 0) > AI_IMAGE_RUN_STALE_TIMEOUT_MS;
}
async function failStaleImageRun(record) {
    if (!isStaleImageRun(record)) {
        return record;
    }
    const now = Date.now();
    await markAiToolImageRunFailed({
        runId: record._id,
        errorCode: 'JOB_TIMEOUT',
        message: '图片修复超时，请重新提交',
        now,
    });
    return {
        ...record,
        status: 'failed',
        title: '修复超时',
        summary: '图片修复超时，请重新提交',
        outputText: '图片修复超时，请重新提交',
        errorCode: 'JOB_TIMEOUT',
        errorMessage: '图片修复超时，请重新提交',
        updatedAt: now,
    };
}
async function hydrateOutputImages(outputImages) {
    if (!(outputImages === null || outputImages === void 0 ? void 0 : outputImages.length)) {
        return undefined;
    }
    const result = await db_1.app.getTempFileURL({
        fileList: outputImages.map((item) => ({ fileID: item.fileId, maxAge: 60 * 60 })),
    });
    return outputImages.map((item, index) => {
        var _a;
        return ({
            ...item,
            url: (_a = result.fileList[index]) === null || _a === void 0 ? void 0 : _a.tempFileURL,
        });
    });
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
async function markImageRunSubmitted(params) {
    await (0, db_1.collection)('aiToolRuns').doc(params.runId).update({
        data: {
            status: 'processing',
            title: '照片修复中',
            summary: '旧照片已提交修复，通常需要几十秒到数分钟。',
            outputText: '照片修复中，请稍后查看结果。',
            usage: params.usage,
            assetIds: [params.sourceFileId],
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
    const rawUser = await (0, db_1.getUserByOpenId)(openid);
    if (!rawUser) {
        return {
            ok: false,
            code: 'UNAUTHENTICATED',
            message: '请先登录后再使用',
        };
    }
    const user = await (0, points_rewards_1.migrateLegacyPointsBalanceToAiToolPoints)(rawUser, now);
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
    const baseUsage = {
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
    };
    if (normalized.input.toolId === 'imageRepair') {
        const completedAt = Date.now();
        const sourceFileId = normalized.input.assetIds[0] || '';
        if (!normalized.input.imageDataUrl && !sourceFileId) {
            await (0, ai_tool_entitlements_1.releaseAiToolUsageReservation)({
                user,
                tool: toolConfig,
                charge,
                runId,
                now: completedAt,
            });
            await markRunFailed({
                runId,
                code: 'INVALID_INPUT',
                message: '请先上传需要修复的旧照片',
                now: completedAt,
            });
            return {
                ok: false,
                code: 'INVALID_INPUT',
                message: '请先上传需要修复的旧照片',
            };
        }
        try {
            const sourceImage = sourceFileId
                ? await (0, ai_image_worker_1.getAiToolSourceImageTempUrl)(sourceFileId)
                : await (0, ai_image_worker_1.uploadAiToolSourceImage)({
                    userId: user._id,
                    runId,
                    imageDataUrl: normalized.input.imageDataUrl,
                });
            const modelName = toolConfig.workerModel || 'google:image-flash';
            await (0, ai_image_worker_1.submitOldPhotoRestoreJob)({
                runId,
                inputImageUrl: sourceImage.tempFileURL,
                model: modelName,
            });
            const imageUsage = {
                ...baseUsage,
                model: modelName,
            };
            await markImageRunSubmitted({
                runId,
                usage: imageUsage,
                modelProvider: modelName.startsWith('google:') || modelName.startsWith('gemini:') ? 'google' : 'openai',
                modelName,
                sourceFileId: sourceImage.fileId,
                now: Date.now(),
            });
            return {
                ok: true,
                data: {
                    result: {
                        runId,
                        status: 'processing',
                        toolId: normalized.input.toolId,
                        title: '照片修复中',
                        summary: '旧照片已提交修复，通常需要几十秒到数分钟。',
                        outputText: '照片修复中，请稍后查看结果。',
                        usage: imageUsage,
                        createdAt: now,
                    },
                    textResult: {
                        title: '照片修复中',
                        summary: '旧照片已提交修复，通常需要几十秒到数分钟。',
                        points: [],
                        outputText: '照片修复中，请稍后查看结果。',
                    },
                },
            };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            await (0, ai_tool_entitlements_1.releaseAiToolUsageReservation)({
                user,
                tool: toolConfig,
                charge,
                runId,
                now: Date.now(),
            });
            await markRunFailed({
                runId,
                code: 'MODEL_FAILED',
                message,
                now: Date.now(),
            });
            return {
                ok: false,
                code: 'MODEL_FAILED',
                message,
            };
        }
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
        ...baseUsage,
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
        const finalRecord = await failStaleImageRun({ ...record, _id: normalizedRunId });
        return {
            ok: true,
            data: await toRunResult(finalRecord),
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
async function listAiToolRuns(params, openid) {
    await ensureAiToolCollections();
    const normalizedToolId = String(params.toolId || '').trim();
    if (!normalizedToolId || !(0, ai_tool_core_1.getAiToolDefinition)(normalizedToolId)) {
        return {
            ok: false,
            code: 'INVALID_INPUT',
            message: '缺少有效工具 ID',
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
    const limit = Math.max(1, Math.min(50, Math.floor(params.limit || 30)));
    const result = await (0, db_1.collection)('aiToolRuns')
        .where({
        userId: user._id,
        toolId: normalizedToolId,
    })
        .get();
    const records = result.data
        .map((record) => ({ ...record, _id: String(record._id || '') }))
        .filter((record) => Boolean(record._id))
        .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0))
        .slice(0, limit);
    return {
        ok: true,
        data: await Promise.all(records.map(async (record) => toRunResult(await failStaleImageRun(record)))),
    };
}
async function findRunById(runId) {
    try {
        const result = await (0, db_1.collection)('aiToolRuns').doc(runId).get();
        const record = result.data;
        return record ? { ...record, _id: runId } : null;
    }
    catch (_a) {
        return null;
    }
}
async function markAiToolImageRunSucceeded(params) {
    var _a;
    const now = (_a = params.now) !== null && _a !== void 0 ? _a : Date.now();
    await (0, db_1.collection)('aiToolRuns').doc(params.runId).update({
        data: {
            status: 'succeeded',
            title: '老照片修复完成',
            summary: params.message || '照片已完成修复，可保存结果图。',
            outputText: '老照片修复完成。',
            outputImages: [{ fileId: params.fileId }],
            ...(params.modelName ? { modelName: params.modelName } : {}),
            updatedAt: now,
        },
    });
}
async function markAiToolImageRunFailed(params) {
    var _a;
    const now = (_a = params.now) !== null && _a !== void 0 ? _a : Date.now();
    const record = await findRunById(params.runId);
    if (record) {
        await releaseAsyncRunReservation(record, now);
    }
    await (0, db_1.collection)('aiToolRuns').doc(params.runId).update({
        data: {
            status: 'failed',
            title: '修复失败',
            summary: params.message,
            outputText: params.message,
            errorCode: params.errorCode || 'MODEL_FAILED',
            errorMessage: params.message,
            updatedAt: now,
        },
    });
}
async function releaseAsyncRunReservation(record, now) {
    var _a;
    const usage = record.usage;
    if (!usage) {
        return;
    }
    const usageResult = await (0, db_1.collection)('aiToolUserUsage')
        .where({ userId: record.userId, toolId: record.toolId })
        .limit(1)
        .get();
    const usageRecord = usageResult.data[0];
    if (usageRecord === null || usageRecord === void 0 ? void 0 : usageRecord._id) {
        await (0, db_1.collection)('aiToolUserUsage').doc(usageRecord._id).update({
            data: {
                ...(usage.chargeMode === 'trial' ? { trialUsed: db_1._.inc(-1) } : {}),
                consumeCount: db_1._.inc(-1),
                updatedAt: now,
            },
        });
    }
    if (usage.chargeMode === 'single') {
        const entitlementResult = await (0, db_1.collection)('aiToolSingleEntitlements')
            .where({ userId: record.userId, toolId: record.toolId, usedRunId: record._id })
            .limit(1)
            .get();
        const entitlement = entitlementResult.data[0];
        if (entitlement === null || entitlement === void 0 ? void 0 : entitlement._id) {
            await (0, db_1.collection)('aiToolSingleEntitlements').doc(entitlement._id).update({
                data: {
                    status: 'available',
                    usedRunId: '',
                    usedAt: 0,
                    updatedAt: now,
                },
            });
        }
        return;
    }
    const pointCost = Math.max(0, Math.floor((_a = usage.pointCost) !== null && _a !== void 0 ? _a : 0));
    if (usage.chargeMode !== 'points' || pointCost <= 0) {
        return;
    }
    await (0, db_1.collection)('users').doc(record.userId).update({
        data: {
            aiToolPointsBalance: db_1._.inc(pointCost),
            updatedAt: now,
        },
    });
    const refreshedUser = await (0, db_1.getUserById)(record.userId);
    await (0, db_1.collection)('aiToolPointsLedger').add({
        data: {
            userId: record.userId,
            openid: record.openid,
            toolId: record.toolId,
            runId: record._id,
            type: 'adjustment',
            direction: 'in',
            points: pointCost,
            balanceAfter: refreshedUser === null || refreshedUser === void 0 ? void 0 : refreshedUser.aiToolPointsBalance,
            description: '老照片修复失败退回积分',
            createdAt: now,
        },
    });
}
