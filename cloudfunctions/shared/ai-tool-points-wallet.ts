import { _, collection, ensureCollection, getUserById } from './db';
import { planAiToolPointBucketDeductions } from './ai-tool-points-policy';
import type {
  AiToolPointBucketDeduction,
  AiToolPointBucketRecord,
  AiToolPointBucketSourceType,
  AiToolPointsLedgerRecord,
  UserRecord,
} from './types';

export interface GrantAiToolPointBucketInput {
  userId: string;
  openid?: string;
  sourceType: AiToolPointBucketSourceType;
  points: number;
  orderNo?: string;
  relatedUserId?: string;
  milestoneKey?: string;
  expiresAt?: number;
  now: number;
}

export type AiToolPointConsumeResult =
  | {
      ok: true;
      points: number;
      balanceAfter: number;
      bucketDeductions: AiToolPointBucketDeduction[];
    }
  | {
      ok: false;
      balance: number;
    };

let walletCollectionsReady = false;

async function ensureAiToolPointWalletCollections(): Promise<void> {
  if (walletCollectionsReady) {
    return;
  }
  await Promise.all([
    ensureCollection('aiToolPointBuckets'),
    ensureCollection('aiToolPointsLedger'),
  ]);
  walletCollectionsReady = true;
}

function normalizeNonNegativeInteger(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function isUsableBucket(bucket: AiToolPointBucketRecord, now: number): boolean {
  return bucket.status === 'active'
    && normalizeNonNegativeInteger(bucket.pointsRemaining) > 0
    && (!bucket.expiresAt || bucket.expiresAt > now);
}

async function listUserPointBuckets(userId: string): Promise<Array<AiToolPointBucketRecord & { _id: string }>> {
  const result = await collection('aiToolPointBuckets').where({ userId }).get();
  return result.data as Array<AiToolPointBucketRecord & { _id: string }>;
}

async function setUserAiToolPointsBalance(userId: string, balance: number, now: number): Promise<void> {
  await collection('users').doc(userId).update({
    data: {
      aiToolPointsBalance: balance,
      updatedAt: now,
    },
  });
}

export async function expireAiToolPointBuckets(userId: string, now: number): Promise<number> {
  await ensureAiToolPointWalletCollections();
  const buckets = await listUserPointBuckets(userId);
  const expiredBuckets = buckets.filter((bucket) => (
    bucket.status === 'active'
    && Boolean(bucket.expiresAt)
    && Number(bucket.expiresAt) <= now
    && normalizeNonNegativeInteger(bucket.pointsRemaining) > 0
  ));
  if (expiredBuckets.length === 0) {
    return 0;
  }

  let expiredPoints = 0;
  for (const bucket of expiredBuckets) {
    const points = normalizeNonNegativeInteger(bucket.pointsRemaining);
    expiredPoints += points;
    await collection('aiToolPointBuckets').doc(bucket._id).update({
      data: {
        pointsRemaining: 0,
        status: 'expired',
        updatedAt: now,
      },
    });
  }
  return expiredPoints;
}

export async function refreshAiToolPointsBalance(userId: string, now = Date.now()): Promise<number> {
  await ensureAiToolPointWalletCollections();
  const expiredPoints = await expireAiToolPointBuckets(userId, now);
  const buckets = await listUserPointBuckets(userId);
  const balance = buckets
    .filter((bucket) => isUsableBucket(bucket, now))
    .reduce((total, bucket) => total + normalizeNonNegativeInteger(bucket.pointsRemaining), 0);

  await setUserAiToolPointsBalance(userId, balance, now);

  if (expiredPoints > 0) {
    const user = await getUserById(userId);
    const ledger: AiToolPointsLedgerRecord = {
      userId,
      openid: user?.openid,
      type: 'points_expire',
      direction: 'out',
      points: expiredPoints,
      balanceAfter: balance,
      description: `套餐积分到期失效${expiredPoints}积分`,
      createdAt: now,
    };
    await collection('aiToolPointsLedger').add({ data: ledger });
  }

  return balance;
}

export async function grantAiToolPointBucket(input: GrantAiToolPointBucketInput): Promise<{
  bucketId: string;
  balanceAfter: number;
}> {
  await ensureAiToolPointWalletCollections();
  const points = normalizeNonNegativeInteger(input.points);
  if (points <= 0) {
    return {
      bucketId: '',
      balanceAfter: await refreshAiToolPointsBalance(input.userId, input.now),
    };
  }

  const record: AiToolPointBucketRecord = {
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
  const result = await collection('aiToolPointBuckets').add({ data: record });
  const balanceAfter = await refreshAiToolPointsBalance(input.userId, input.now);
  return {
    bucketId: result._id,
    balanceAfter,
  };
}

export async function consumeAiToolPoints(params: {
  user: UserRecord & { _id: string };
  points: number;
  now: number;
}): Promise<AiToolPointConsumeResult> {
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
  const bucketDeductions = planAiToolPointBucketDeductions(buckets, points, params.now);
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
    const nextRemaining = Math.max(0, normalizeNonNegativeInteger(bucket?.pointsRemaining) - deduction.points);
    await collection('aiToolPointBuckets').doc(deduction.bucketId).update({
      data: {
        pointsRemaining: _.inc(-deduction.points),
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

export async function refundAiToolPoints(params: {
  user: UserRecord & { _id: string };
  bucketDeductions: readonly AiToolPointBucketDeduction[];
  now: number;
}): Promise<number> {
  await ensureAiToolPointWalletCollections();
  for (const deduction of params.bucketDeductions) {
    const bucketResult = await collection('aiToolPointBuckets').doc(deduction.bucketId).get();
    const bucket = bucketResult.data as (AiToolPointBucketRecord & { _id: string }) | undefined;
    if (!bucket) {
      continue;
    }
    const expired = Boolean(bucket.expiresAt) && Number(bucket.expiresAt) <= params.now;
    if (expired) {
      await collection('aiToolPointBuckets').doc(deduction.bucketId).update({
        data: {
          status: 'expired',
          updatedAt: params.now,
        },
      });
      continue;
    }
    const nextRemaining = normalizeNonNegativeInteger(bucket.pointsRemaining) + normalizeNonNegativeInteger(deduction.points);
    await collection('aiToolPointBuckets').doc(deduction.bucketId).update({
      data: {
        pointsRemaining: _.inc(normalizeNonNegativeInteger(deduction.points)),
        status: nextRemaining > 0 ? 'active' : bucket.status,
        updatedAt: params.now,
      },
    });
  }
  return refreshAiToolPointsBalance(params.user._id, params.now);
}
