import { createHash } from 'node:crypto';

import { collection, ensureCollection, getUserByOpenId } from './db';
import { getEffectiveAiToolConfig, releaseAiToolUsageReservation, reserveAiToolUsage } from './ai-tool-entitlements';
import {
  buildAiToolContent,
  fallbackTextResult,
  generateAiToolText,
  type AiToolTextResult,
} from './ai-tool-generation';
import {
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
    .digest('hex');
}

function toRunResult(record: RunWithId): RunAiToolResult {
  return {
    runId: record._id,
    status: record.status,
    toolId: record.toolId,
    title: record.title || (record.status === 'failed' ? '生成失败' : '结果处理中'),
    summary: record.summary,
    points: record.points,
    outputText: record.outputText,
    outputImages: record.outputImages,
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
  const user = await getUserByOpenId(openid);
  if (!user) {
    return {
      ok: false,
      code: 'UNAUTHENTICATED',
      message: '请先登录后再使用',
    };
  }

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
    return {
      ok: true,
      data: toRunResult({ ...record, _id: normalizedRunId }),
    };
  } catch {
    return {
      ok: false,
      code: 'NOT_FOUND',
      message: '未找到该执行结果',
    };
  }
}
