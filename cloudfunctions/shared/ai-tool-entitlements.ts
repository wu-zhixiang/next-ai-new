import { _, collection, ensureCollection, getUserById } from './db';
import {
  buildDefaultAiToolRecord,
  getDefaultAdminToolDefinitions,
  normalizeToolConfigStatus,
  type AiToolConfigRecord,
} from './ai-tool-config';
import type {
  AiToolPointsLedgerRecord,
  AiToolSingleEntitlementRecord,
  AiToolUserUsageRecord,
  OrderRecord,
  UserRecord,
} from './types';

export interface EffectiveAiToolConfig {
  toolId: string;
  name: string;
  enabled: boolean;
  status: AiToolConfigRecord['status'];
  pointCost: number;
  trialLimit: number;
}

export type AiToolChargeResult =
  | {
      ok: true;
      mode: 'trial' | 'points' | 'single';
      pointCost: number;
      trialLimit: number;
      trialRemaining: number;
      balanceAfter?: number;
      singleEntitlementId?: string;
    }
  | {
      ok: false;
      code: 'QUOTA_EXCEEDED';
      message: string;
      pointCost: number;
      balance: number;
      singlePurchaseAmount: number;
    };

let collectionsReady = false;

async function ensureAiToolEntitlementCollections(): Promise<void> {
  if (collectionsReady) {
    return;
  }
  await Promise.all([
    ensureCollection('aiToolUserUsage'),
    ensureCollection('aiToolPointsLedger'),
    ensureCollection('aiToolSingleEntitlements'),
  ]);
  collectionsReady = true;
}

function normalizeNonNegativeInteger(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

async function getToolOverride(toolId: string): Promise<(AiToolConfigRecord & { _id: string }) | undefined> {
  try {
    await ensureCollection('aiTools');
    const result = await collection('aiTools')
      .where({ toolId })
      .limit(1)
      .get();
    return result.data[0] as (AiToolConfigRecord & { _id: string }) | undefined;
  } catch {
    return undefined;
  }
}

export async function getEffectiveAiToolConfig(toolId: string): Promise<EffectiveAiToolConfig | null> {
  const definition = getDefaultAdminToolDefinitions().find((item) => item.toolId === toolId);
  if (!definition) {
    return null;
  }
  const base = buildDefaultAiToolRecord(definition);
  const override = await getToolOverride(toolId);
  if (override?.deleted) {
    return {
      toolId,
      name: override.name || base.name,
      enabled: false,
      status: 'disabled',
      pointCost: normalizeNonNegativeInteger(override.pointCost ?? base.pointCost),
      trialLimit: normalizeNonNegativeInteger(override.trialLimit ?? base.trialLimit),
    };
  }
  const merged = override ? { ...base, ...override, toolId } : base;
  const status = normalizeToolConfigStatus(merged.status);
  return {
    toolId,
    name: merged.cardTitle || merged.name,
    enabled: status === 'enabled',
    status,
    pointCost: normalizeNonNegativeInteger(merged.pointCost),
    trialLimit: normalizeNonNegativeInteger(merged.trialLimit),
  };
}

async function getUsageRecord(userId: string, toolId: string): Promise<(AiToolUserUsageRecord & { _id: string }) | null> {
  await ensureAiToolEntitlementCollections();
  const result = await collection('aiToolUserUsage')
    .where({ userId, toolId })
    .limit(1)
    .get();
  return (result.data[0] as (AiToolUserUsageRecord & { _id: string }) | undefined) ?? null;
}

async function createUsageRecord(user: UserRecord & { _id: string }, toolId: string, now: number): Promise<AiToolUserUsageRecord & { _id: string }> {
  const record: AiToolUserUsageRecord = {
    userId: user._id,
    openid: user.openid,
    toolId,
    trialUsed: 0,
    consumeCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const result = await collection('aiToolUserUsage').add({ data: record });
  return { ...record, _id: result._id };
}

async function getOrCreateUsageRecord(
  user: UserRecord & { _id: string },
  toolId: string,
  now: number,
): Promise<AiToolUserUsageRecord & { _id: string }> {
  return await getUsageRecord(user._id, toolId) ?? await createUsageRecord(user, toolId, now);
}

async function findAvailableSingleEntitlement(
  userId: string,
  toolId: string,
): Promise<(AiToolSingleEntitlementRecord & { _id: string }) | null> {
  await ensureAiToolEntitlementCollections();
  const result = await collection('aiToolSingleEntitlements')
    .where({ userId, toolId, status: 'available' })
    .limit(1)
    .get();
  return (result.data[0] as (AiToolSingleEntitlementRecord & { _id: string }) | undefined) ?? null;
}

export async function reserveAiToolUsage(params: {
  user: UserRecord & { _id: string };
  tool: EffectiveAiToolConfig;
  runId: string;
  now: number;
}): Promise<AiToolChargeResult> {
  await ensureAiToolEntitlementCollections();
  const usage = await getOrCreateUsageRecord(params.user, params.tool.toolId, params.now);
  if (usage.trialUsed < params.tool.trialLimit) {
    await collection('aiToolUserUsage').doc(usage._id).update({
      data: {
        trialUsed: _.inc(1),
        consumeCount: _.inc(1),
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
    await collection('aiToolSingleEntitlements').doc(entitlement._id).update({
      data: {
        status: 'used',
        usedRunId: params.runId,
        usedAt: params.now,
        updatedAt: params.now,
      },
    });
    await collection('aiToolUserUsage').doc(usage._id).update({
      data: {
        consumeCount: _.inc(1),
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

  await collection('users').doc(params.user._id).update({
    data: {
      aiToolPointsBalance: _.inc(-params.tool.pointCost),
      updatedAt: params.now,
    },
  });
  const refreshedUser = await getUserById(params.user._id);
  const ledger: AiToolPointsLedgerRecord = {
    userId: params.user._id,
    openid: params.user.openid,
    toolId: params.tool.toolId,
    runId: params.runId,
    type: 'tool_consume',
    direction: 'out',
    points: params.tool.pointCost,
    balanceAfter: refreshedUser?.aiToolPointsBalance,
    description: `使用${params.tool.name}消耗${params.tool.pointCost}积分`,
    createdAt: params.now,
  };
  await collection('aiToolPointsLedger').add({ data: ledger });
  await collection('aiToolUserUsage').doc(usage._id).update({
    data: {
      consumeCount: _.inc(1),
      updatedAt: params.now,
    },
  });
  return {
    ok: true,
    mode: 'points',
    pointCost: params.tool.pointCost,
    trialLimit: params.tool.trialLimit,
    trialRemaining: 0,
    balanceAfter: refreshedUser?.aiToolPointsBalance,
  };
}

export async function releaseAiToolUsageReservation(params: {
  user: UserRecord & { _id: string };
  tool: EffectiveAiToolConfig;
  charge: Extract<AiToolChargeResult, { ok: true }>;
  runId: string;
  now: number;
}): Promise<void> {
  await ensureAiToolEntitlementCollections();
  const usage = await getUsageRecord(params.user._id, params.tool.toolId);
  if (usage) {
    await collection('aiToolUserUsage').doc(usage._id).update({
      data: {
        ...(params.charge.mode === 'trial' ? { trialUsed: _.inc(-1) } : {}),
        consumeCount: _.inc(-1),
        updatedAt: params.now,
      },
    });
  }

  if (params.charge.mode === 'single' && params.charge.singleEntitlementId) {
    await collection('aiToolSingleEntitlements').doc(params.charge.singleEntitlementId).update({
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

  await collection('users').doc(params.user._id).update({
    data: {
      aiToolPointsBalance: _.inc(params.charge.pointCost),
      updatedAt: params.now,
    },
  });
  const refreshedUser = await getUserById(params.user._id);
  const ledger: AiToolPointsLedgerRecord = {
    userId: params.user._id,
    openid: params.user.openid,
    toolId: params.tool.toolId,
    runId: params.runId,
    type: 'adjustment',
    direction: 'in',
    points: params.charge.pointCost,
    balanceAfter: refreshedUser?.aiToolPointsBalance,
    description: `${params.tool.name}生成失败退回${params.charge.pointCost}积分`,
    createdAt: params.now,
  };
  await collection('aiToolPointsLedger').add({ data: ledger });
}

export async function grantAiToolPlanPointsOnce(order: OrderRecord & { _id: string }, paidAt: number): Promise<void> {
  await ensureAiToolEntitlementCollections();
  const points = normalizeNonNegativeInteger(order.totalAiPoints);
  if (points <= 0 || order.orderType === 'tool_single') {
    return;
  }

  const existing = await collection('aiToolPointsLedger')
    .where({ userId: order.userId, orderNo: order.orderNo, type: 'plan_grant' })
    .limit(1)
    .get();
  if (existing.data[0]) {
    return;
  }

  await collection('users').doc(order.userId).update({
    data: {
      aiToolPointsBalance: _.inc(points),
      updatedAt: paidAt,
    },
  });
  const user = await getUserById(order.userId);
  const ledger: AiToolPointsLedgerRecord = {
    userId: order.userId,
    openid: user?.openid,
    orderNo: order.orderNo,
    type: 'plan_grant',
    direction: 'in',
    points,
    balanceAfter: user?.aiToolPointsBalance,
    description: `购买${order.planName}发放${points}AI工具积分`,
    createdAt: paidAt,
  };
  await collection('aiToolPointsLedger').add({ data: ledger });
}

export async function grantSingleToolEntitlementOnce(order: OrderRecord & { _id: string }, paidAt: number): Promise<void> {
  await ensureAiToolEntitlementCollections();
  if (order.orderType !== 'tool_single' || !order.toolId) {
    return;
  }
  const user = await getUserById(order.userId);
  if (!user?.openid) {
    return;
  }

  const existingEntitlement = await collection('aiToolSingleEntitlements')
    .where({ userId: order.userId, orderNo: order.orderNo, toolId: order.toolId })
    .limit(1)
    .get();
  if (!existingEntitlement.data[0]) {
    const entitlement: AiToolSingleEntitlementRecord = {
      userId: order.userId,
      openid: user.openid,
      toolId: order.toolId,
      orderNo: order.orderNo,
      status: 'available',
      createdAt: paidAt,
      updatedAt: paidAt,
    };
    await collection('aiToolSingleEntitlements').add({ data: entitlement });
  }

  const existingLedger = await collection('aiToolPointsLedger')
    .where({ userId: order.userId, orderNo: order.orderNo, type: 'single_purchase' })
    .limit(1)
    .get();
  if (existingLedger.data[0]) {
    return;
  }

  const ledger: AiToolPointsLedgerRecord = {
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
  await collection('aiToolPointsLedger').add({ data: ledger });
}
