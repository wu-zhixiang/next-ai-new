import { _, collection, ensureCollection, getUserById } from './db';
import {
  DEFAULT_IMAGE_REPAIR_WORKER_MODEL,
  buildDefaultAiToolRecord,
  getDefaultAdminToolDefinitions,
  normalizeAiToolWorkerModel,
  normalizeToolConfigStatus,
  type AiToolConfigRecord,
} from './ai-tool-config';
import type {
  AiToolPointBucketDeduction,
  AiToolPointBucketRecord,
  AiToolPointsLedgerRecord,
  AiToolSingleEntitlementRecord,
  AiToolUserUsageRecord,
  MemberPlanRecord,
  MembershipRecord,
  OrderRecord,
  UserRecord,
} from './types';
import {
  consumeAiToolPoints,
  grantAiToolPointBucket,
  refreshAiToolPointsBalance,
  refundAiToolPoints,
} from './ai-tool-points-wallet';

export interface EffectiveAiToolConfig {
  toolId: string;
  name: string;
  enabled: boolean;
  status: AiToolConfigRecord['status'];
  pointCost: number;
  trialLimit: number;
  workerModel?: string;
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
      bucketDeductions?: AiToolPointBucketDeduction[];
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
    ensureCollection('aiToolPointBuckets'),
    ensureCollection('aiToolSingleEntitlements'),
  ]);
  collectionsReady = true;
}

function normalizeNonNegativeInteger(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function isActiveMembership(record: MembershipRecord, now: number): boolean {
  return record.status === 'active' && record.endAt > now;
}

function isAiToolPointPlan(record: Pick<MemberPlanRecord, 'totalAiPoints'>): boolean {
  return normalizeNonNegativeInteger(record.totalAiPoints) > 0;
}

function isActiveAiToolPointOrder(record: OrderRecord, now: number): boolean {
  if (
    record.orderType === 'tool_single'
    || record.payStatus !== 'paid'
    || record.fulfillmentStatus !== 'fulfilled'
    || !isAiToolPointPlan(record)
  ) {
    return false;
  }
  const startAt = record.fulfilledAt ?? record.paidAt;
  if (!startAt || record.durationDays <= 0) {
    return false;
  }
  return startAt + record.durationDays * 24 * 60 * 60 * 1000 > now;
}

function isUsableAiToolPointBucket(record: AiToolPointBucketRecord, now: number): boolean {
  return record.sourceType === 'plan'
    && record.status === 'active'
    && normalizeNonNegativeInteger(record.pointsRemaining) > 0
    && (!record.expiresAt || record.expiresAt > now);
}

export function hasActiveAiToolPointPlanFromRecords(params: {
  memberships: readonly MembershipRecord[];
  plans: readonly MemberPlanRecord[];
  orders: readonly OrderRecord[];
  now: number;
}): boolean {
  if (params.orders.some((order) => isActiveAiToolPointOrder(order, params.now))) {
    return true;
  }
  const activeMemberships = params.memberships.filter((membership) => isActiveMembership(membership, params.now));
  if (activeMemberships.length === 0) {
    return false;
  }
  const aiToolPlans = params.plans.filter(isAiToolPointPlan);
  return activeMemberships.some((membership) => (
    aiToolPlans.some((plan) => (
      plan.productCode === membership.productCode && plan.planCode === membership.planCode
    ))
  ));
}

async function hasActiveAiToolPointPlan(userId: string, now: number): Promise<boolean> {
  await Promise.all([
    ensureCollection('memberships'),
    ensureCollection('memberPlans'),
    ensureCollection('orders'),
    ensureCollection('aiToolPointBuckets'),
  ]);
  const [membershipsResult, plansResult, ordersResult, bucketsResult] = await Promise.all([
    collection('memberships').where({ userId }).get(),
    collection('memberPlans').where({ status: 'on' }).get(),
    collection('orders').where({ userId, payStatus: 'paid' }).get(),
    collection('aiToolPointBuckets').where({ userId, sourceType: 'plan', status: 'active' }).get(),
  ]);
  if ((bucketsResult.data as AiToolPointBucketRecord[]).some((bucket) => isUsableAiToolPointBucket(bucket, now))) {
    return true;
  }
  return hasActiveAiToolPointPlanFromRecords({
    memberships: membershipsResult.data as MembershipRecord[],
    plans: plansResult.data as MemberPlanRecord[],
    orders: ordersResult.data as OrderRecord[],
    now,
  });
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
      workerModel: normalizeAiToolWorkerModel(override.workerModel ?? base.workerModel),
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
    workerModel: normalizeAiToolWorkerModel(merged.workerModel, toolId === 'imageRepair' ? DEFAULT_IMAGE_REPAIR_WORKER_MODEL : ''),
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

  const balance = await refreshAiToolPointsBalance(params.user._id, params.now);
  const aiToolPointPlanActive = await hasActiveAiToolPointPlan(params.user._id, params.now);
  if (!aiToolPointPlanActive) {
    return {
      ok: false,
      code: 'QUOTA_EXCEEDED',
      message: '请单次购买或开通AI工具套餐后继续使用',
      pointCost: params.tool.pointCost,
      balance,
      singlePurchaseAmount: Number((params.tool.pointCost / 10).toFixed(2)),
    };
  }

  const consumeResult = await consumeAiToolPoints({
    user: params.user,
    points: params.tool.pointCost,
    now: params.now,
  });
  if (consumeResult.ok === false) {
    return {
      ok: false,
      code: 'QUOTA_EXCEEDED',
      message: 'AI工具积分不足',
      pointCost: params.tool.pointCost,
      balance: consumeResult.balance,
      singlePurchaseAmount: Number((params.tool.pointCost / 10).toFixed(2)),
    };
  }

  const ledger: AiToolPointsLedgerRecord = {
    userId: params.user._id,
    openid: params.user.openid,
    toolId: params.tool.toolId,
    runId: params.runId,
    type: 'tool_consume',
    direction: 'out',
    points: params.tool.pointCost,
    bucketDeductions: consumeResult.bucketDeductions,
    balanceAfter: consumeResult.balanceAfter,
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
    balanceAfter: consumeResult.balanceAfter,
    bucketDeductions: consumeResult.bucketDeductions,
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

  const balanceAfter = await refundAiToolPoints({
    user: params.user,
    bucketDeductions: params.charge.bucketDeductions ?? [],
    now: params.now,
  });
  const ledger: AiToolPointsLedgerRecord = {
    userId: params.user._id,
    openid: params.user.openid,
    toolId: params.tool.toolId,
    runId: params.runId,
    type: 'adjustment',
    direction: 'in',
    points: params.charge.pointCost,
    bucketDeductions: params.charge.bucketDeductions,
    balanceAfter,
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

  const user = await getUserById(order.userId);
  const expiresAt = order.durationDays > 0 ? paidAt + order.durationDays * 24 * 60 * 60 * 1000 : undefined;
  const grantResult = await grantAiToolPointBucket({
    userId: order.userId,
    openid: user?.openid,
    sourceType: 'plan',
    points,
    orderNo: order.orderNo,
    expiresAt,
    now: paidAt,
  });
  const ledger: AiToolPointsLedgerRecord = {
    userId: order.userId,
    openid: user?.openid,
    orderNo: order.orderNo,
    type: 'plan_grant',
    direction: 'in',
    points,
    balanceAfter: grantResult.balanceAfter,
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
