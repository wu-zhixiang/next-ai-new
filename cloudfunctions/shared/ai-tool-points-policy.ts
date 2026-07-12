import type {
  AiToolPointBucketDeduction,
  AiToolPointBucketRecord,
} from './types';

function normalizeNonNegativeInteger(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : 0;
}

function isUsableBucket(bucket: AiToolPointBucketRecord, now: number): boolean {
  return bucket.status === 'active'
    && normalizeNonNegativeInteger(bucket.pointsRemaining) > 0
    && (!bucket.expiresAt || bucket.expiresAt > now);
}

function sortConsumableBuckets(
  left: AiToolPointBucketRecord & { _id: string },
  right: AiToolPointBucketRecord & { _id: string },
): number {
  const leftExpiresAt = left.expiresAt ?? Number.MAX_SAFE_INTEGER;
  const rightExpiresAt = right.expiresAt ?? Number.MAX_SAFE_INTEGER;
  if (leftExpiresAt !== rightExpiresAt) {
    return leftExpiresAt - rightExpiresAt;
  }
  return left.createdAt - right.createdAt;
}

export function planAiToolPointBucketDeductions(
  buckets: Array<AiToolPointBucketRecord & { _id: string }>,
  points: number,
  now: number,
): AiToolPointBucketDeduction[] {
  let remaining = normalizeNonNegativeInteger(points);
  if (remaining <= 0) {
    return [];
  }

  const deductions: AiToolPointBucketDeduction[] = [];
  for (const bucket of buckets.filter((item) => isUsableBucket(item, now)).sort(sortConsumableBuckets)) {
    if (remaining <= 0) {
      break;
    }
    const bucketPoints = normalizeNonNegativeInteger(bucket.pointsRemaining);
    const pointsFromBucket = Math.min(bucketPoints, remaining);
    if (pointsFromBucket <= 0) {
      continue;
    }
    deductions.push({
      bucketId: bucket._id,
      sourceType: bucket.sourceType,
      points: pointsFromBucket,
      expiresAt: bucket.expiresAt,
    });
    remaining -= pointsFromBucket;
  }
  return deductions;
}
