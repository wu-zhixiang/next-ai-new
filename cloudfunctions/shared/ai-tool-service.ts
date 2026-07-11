import { createHash } from 'node:crypto';

import { _, app, collection, ensureCollection, getUserById, getUserByOpenId } from './db';
import { getEffectiveAiToolConfig, releaseAiToolUsageReservation, reserveAiToolUsage } from './ai-tool-entitlements';
import { migrateLegacyPointsBalanceToAiToolPoints } from './points-rewards';
import {
  buildAiToolContent,
  fallbackTextResult,
  generateAiToolText,
  type AiToolTextResult,
} from './ai-tool-generation';
import {
  getAiToolSourceImageTempUrl,
  submitOldPhotoRestoreJob,
  uploadAiToolSourceImage,
} from './ai-image-worker';
import {
  getAiToolDefinition,
  normalizeRunAiToolInput,
  type AiToolErrorCode,
  type NormalizedRunAiToolInput,
  type RunAiToolInput,
  type RunAiToolResult,
} from './ai-tool-core';
import type {
  AiToolRunRecord,
  UserRecord,
} from './types';

type UserWithId = UserRecord & { _id: string };
type RunWithId = AiToolRunRecord & { _id: string };
const AI_IMAGE_RUN_STALE_TIMEOUT_MS = 15 * 60 * 1000;

export type AiToolServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AiToolErrorCode; message: string; data?: unknown };

let aiToolCollectionsReady = false;

async function ensureAiToolCollections(): Promise<void> {
  if (aiToolCollectionsReady) {
    return;
  }
  await Promise.all([
    ensureCollection('aiToolRuns'),
  ]);
  aiToolCollectionsReady = true;
}

function createInputDigest(input: {
  toolId: string;
  outputType: string;
  text: string;
  fileText: string;
  imageDataUrl: string;
  assetIds: string[];
}): string {
  return createHash('sha256')
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

async function toRunResult(record: RunWithId): Promise<RunAiToolResult> {
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
    usage: record.usage ?? {
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

function isStaleImageRun(record: RunWithId, now = Date.now()): boolean {
  return record.toolId === 'imageRepair'
    && record.status === 'processing'
    && now - (record.createdAt || record.updatedAt || 0) > AI_IMAGE_RUN_STALE_TIMEOUT_MS;
}

async function failStaleImageRun(record: RunWithId): Promise<RunWithId> {
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

async function hydrateOutputImages(
  outputImages: AiToolRunRecord['outputImages'],
): Promise<RunAiToolResult['outputImages']> {
  if (!outputImages?.length) {
    return undefined;
  }
  const result = await app.getTempFileURL({
    fileList: outputImages.map((item) => ({ fileID: item.fileId, maxAge: 60 * 60 })),
  });
  return outputImages.map((item, index) => ({
    ...item,
    url: result.fileList[index]?.tempFileURL,
  }));
}

async function createProcessingRun(params: {
  user: UserWithId;
  input: NormalizedRunAiToolInput;
  now: number;
}): Promise<string> {
  const record: AiToolRunRecord = {
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
  const result = await collection('aiToolRuns').add({ data: record });
  return result._id;
}

async function markRunSucceeded(params: {
  runId: string;
  textResult: AiToolTextResult;
  usage: RunAiToolResult['usage'];
  modelProvider: string;
  modelName: string;
  now: number;
}): Promise<void> {
  await collection('aiToolRuns').doc(params.runId).update({
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

async function markImageRunSubmitted(params: {
  runId: string;
  usage: RunAiToolResult['usage'];
  modelProvider: string;
  modelName: string;
  sourceFileId: string;
  now: number;
}): Promise<void> {
  await collection('aiToolRuns').doc(params.runId).update({
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

async function markRunFailed(params: {
  runId: string;
  code: AiToolErrorCode;
  message: string;
  modelProvider?: string;
  modelName?: string;
  now: number;
}): Promise<void> {
  await collection('aiToolRuns').doc(params.runId).update({
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

export async function executeAiTool(
  event: RunAiToolInput,
  openid: string,
): Promise<AiToolServiceResult<{ result: RunAiToolResult; textResult: AiToolTextResult }>> {
  const normalized = normalizeRunAiToolInput(event);
  if (normalized.ok === false) {
    return {
      ok: false,
      code: normalized.code,
      message: normalized.message,
    };
  }

  await ensureAiToolCollections();
  const now = Date.now();
  const rawUser = await getUserByOpenId(openid);
  if (!rawUser) {
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: '请先登录后再使用',
    };
  }
  const user = await migrateLegacyPointsBalanceToAiToolPoints(rawUser, now);

  const toolConfig = await getEffectiveAiToolConfig(normalized.input.toolId);
  if (!toolConfig?.enabled) {
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
  const charge = await reserveAiToolUsage({
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

  const baseUsage: RunAiToolResult['usage'] = {
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
      await releaseAiToolUsageReservation({
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
        ? await getAiToolSourceImageTempUrl(sourceFileId)
        : await uploadAiToolSourceImage({
            userId: user._id,
            runId,
            imageDataUrl: normalized.input.imageDataUrl,
          });
      const modelName = toolConfig.workerModel || 'google:image-flash';
      await submitOldPhotoRestoreJob({
        runId,
        inputImageUrl: sourceImage.tempFileURL,
        model: modelName,
      });
      const imageUsage: RunAiToolResult['usage'] = {
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
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await releaseAiToolUsageReservation({
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

  const generated = await generateAiToolText(normalized.input);
  const textResult = generated.result ?? (
    normalized.input.imageDataUrl
      ? null
      : fallbackTextResult(buildAiToolContent(normalized.input), normalized.input.outputType)
  );
  const completedAt = Date.now();
  if (!textResult) {
    const message = generated.errorMessage.includes('CloudBase AI SDK unavailable')
      ? `AI 模型服务不可用：${generated.errorMessage}`
      : `参考素材解析失败：${generated.errorMessage || '请更换素材或补充文字描述'}`;
    await releaseAiToolUsageReservation({
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

  const usage: RunAiToolResult['usage'] = {
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

export async function getAiToolRun(
  runId: string,
  openid: string,
): Promise<AiToolServiceResult<RunAiToolResult>> {
  await ensureAiToolCollections();
  const normalizedRunId = String(runId || '').trim();
  if (!normalizedRunId) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: '缺少执行 ID',
    };
  }

  const user = await getUserByOpenId(openid);
  if (!user) {
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: '请先登录后再使用',
    };
  }

  try {
    const result = await collection('aiToolRuns').doc(normalizedRunId).get();
    const record = result.data as RunWithId | undefined;
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
  } catch {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: '未找到该执行结果',
    };
  }
}

export async function listAiToolRuns(
  params: {
    toolId?: string;
    limit?: number;
  },
  openid: string,
): Promise<AiToolServiceResult<RunAiToolResult[]>> {
  await ensureAiToolCollections();
  const normalizedToolId = String(params.toolId || '').trim();
  if (!normalizedToolId || !getAiToolDefinition(normalizedToolId)) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: '缺少有效工具 ID',
    };
  }

  const user = await getUserByOpenId(openid);
  if (!user) {
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: '请先登录后再使用',
    };
  }

  const limit = Math.max(1, Math.min(50, Math.floor(params.limit || 30)));
  const result = await collection('aiToolRuns')
    .where({
      userId: user._id,
      toolId: normalizedToolId,
    })
    .get();
  const records = (result.data as RunWithId[])
    .map((record) => ({ ...record, _id: String(record._id || '') }))
    .filter((record) => Boolean(record._id))
    .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0))
    .slice(0, limit);

  return {
    ok: true,
    data: await Promise.all(records.map(async (record) => toRunResult(await failStaleImageRun(record)))),
  };
}

async function findRunById(runId: string): Promise<RunWithId | null> {
  try {
    const result = await collection('aiToolRuns').doc(runId).get();
    const record = result.data as RunWithId | undefined;
    return record ? { ...record, _id: runId } : null;
  } catch {
    return null;
  }
}

export async function markAiToolImageRunSucceeded(params: {
  runId: string;
  fileId: string;
  modelName?: string;
  message?: string;
  now?: number;
}): Promise<void> {
  const now = params.now ?? Date.now();
  await collection('aiToolRuns').doc(params.runId).update({
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

export async function markAiToolImageRunFailed(params: {
  runId: string;
  errorCode?: string;
  message: string;
  now?: number;
}): Promise<void> {
  const now = params.now ?? Date.now();
  const record = await findRunById(params.runId);
  if (record) {
    await releaseAsyncRunReservation(record, now);
  }
  await collection('aiToolRuns').doc(params.runId).update({
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

async function releaseAsyncRunReservation(record: RunWithId, now: number): Promise<void> {
  const usage = record.usage;
  if (!usage) {
    return;
  }
  const usageResult = await collection('aiToolUserUsage')
    .where({ userId: record.userId, toolId: record.toolId })
    .limit(1)
    .get();
  const usageRecord = usageResult.data[0] as { _id?: string } | undefined;
  if (usageRecord?._id) {
    await collection('aiToolUserUsage').doc(usageRecord._id).update({
      data: {
        ...(usage.chargeMode === 'trial' ? { trialUsed: _.inc(-1) } : {}),
        consumeCount: _.inc(-1),
        updatedAt: now,
      },
    });
  }
  if (usage.chargeMode === 'single') {
    const entitlementResult = await collection('aiToolSingleEntitlements')
      .where({ userId: record.userId, toolId: record.toolId, usedRunId: record._id })
      .limit(1)
      .get();
    const entitlement = entitlementResult.data[0] as { _id?: string } | undefined;
    if (entitlement?._id) {
      await collection('aiToolSingleEntitlements').doc(entitlement._id).update({
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
  const pointCost = Math.max(0, Math.floor(usage.pointCost ?? 0));
  if (usage.chargeMode !== 'points' || pointCost <= 0) {
    return;
  }
  await collection('users').doc(record.userId).update({
    data: {
      aiToolPointsBalance: _.inc(pointCost),
      updatedAt: now,
    },
  });
  const refreshedUser = await getUserById(record.userId);
  await collection('aiToolPointsLedger').add({
    data: {
      userId: record.userId,
      openid: record.openid,
      toolId: record.toolId,
      runId: record._id,
      type: 'adjustment',
      direction: 'in',
      points: pointCost,
      balanceAfter: refreshedUser?.aiToolPointsBalance,
      description: '老照片修复失败退回积分',
      createdAt: now,
    },
  });
}
