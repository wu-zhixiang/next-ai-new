import { createHash } from 'node:crypto';

import { DEFAULT_PRODUCT_CODE } from './constants';
import { collection, ensureCollection, getMembershipByUserId, getUserByOpenId, _ } from './db';
import {
  buildAiToolContent,
  fallbackTextResult,
  generateAiToolText,
  type AiToolTextResult,
} from './ai-tool-generation';
import {
  getAiToolUsageDateKey,
  normalizeRunAiToolInput,
  resolveAiToolEntitlement,
  type AiToolErrorCode,
  type NormalizedRunAiToolInput,
  type RunAiToolInput,
  type RunAiToolResult,
} from './ai-tool-core';
import type {
  AiToolRunRecord,
  AiToolUsageDailyRecord,
  MembershipRecord,
  UserRecord,
} from './types';

type UserWithId = UserRecord & { _id: string };
type RunWithId = AiToolRunRecord & { _id: string };
type UsageWithId = AiToolUsageDailyRecord & { _id: string };

export type AiToolServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: AiToolErrorCode; message: string };

let aiToolCollectionsReady = false;

async function ensureAiToolCollections(): Promise<void> {
  if (aiToolCollectionsReady) {
    return;
  }
  await Promise.all([
    ensureCollection('aiToolRuns'),
    ensureCollection('aiToolUsageDaily'),
  ]);
  aiToolCollectionsReady = true;
}

function isActiveToolMembership(membership: MembershipRecord | null, now: number): boolean {
  if (!membership) {
    return false;
  }
  if (membership.status === 'opening') {
    return true;
  }
  return membership.status === 'active' && membership.endAt > now;
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

async function getDailyUsage(userId: string, date: string): Promise<UsageWithId | null> {
  const result = await collection('aiToolUsageDaily').where({ userId, date }).limit(1).get();
  return (result.data[0] as UsageWithId | undefined) ?? null;
}

async function recordUsage(
  userId: string,
  date: string,
  usage: RunAiToolResult['usage'],
  now: number,
): Promise<void> {
  const freeIncrement = usage.freeUsed ? 1 : 0;
  const adIncrement = usage.rewardAdUsed ? 1 : 0;
  const memberIncrement = usage.memberUsed ? 1 : 0;
  const existing = await getDailyUsage(userId, date);
  if (!existing) {
    const record: AiToolUsageDailyRecord = {
      userId,
      date,
      freeUsed: freeIncrement,
      adUnlocked: adIncrement,
      memberUsed: memberIncrement,
      updatedAt: now,
    };
    await collection('aiToolUsageDaily').add({ data: record });
    return;
  }

  await collection('aiToolUsageDaily').doc(existing._id).update({
    data: {
      freeUsed: _.inc(freeIncrement),
      adUnlocked: _.inc(adIncrement),
      memberUsed: _.inc(memberIncrement),
      updatedAt: now,
    },
  });
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
      dailyFreeLimit: 1,
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

  const [membership, usageRecord] = await Promise.all([
    getMembershipByUserId(user._id, DEFAULT_PRODUCT_CODE),
    getDailyUsage(user._id, getAiToolUsageDateKey(now)),
  ]);
  const entitlement = resolveAiToolEntitlement({
    isMember: isActiveToolMembership(membership, now),
    freeUsedToday: usageRecord?.freeUsed ?? 0,
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
  await recordUsage(user._id, getAiToolUsageDateKey(completedAt), usage, completedAt);
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
