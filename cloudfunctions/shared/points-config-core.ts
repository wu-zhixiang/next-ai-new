import type { InviteMilestoneConfig, PointsConfigRecord } from './types';

export const POINTS_CONFIG_ID = 'default';
export const DEFAULT_POINTS_PER_YUAN = 1;
export const DEFAULT_INVITE_BASE_REWARD_POINTS = 5;

export interface PointsDeductionResult {
  pointsDeducted: number;
  pointsDeductAmount: number;
  payableAmount: number;
}

function normalizePositiveInteger(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.floor(numeric)) : fallback;
}

function normalizeNonNegativeInteger(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
}

function normalizeMilestoneId(value: unknown, inviteCount: number): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  const normalized = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  return normalized || `invite_${inviteCount}`;
}

export function normalizeInviteMilestones(value: unknown): InviteMilestoneConfig[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const milestones: InviteMilestoneConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const record = item as Record<string, unknown>;
    const inviteCount = normalizePositiveInteger(record.inviteCount, 1);
    const rewardPoints = normalizeNonNegativeInteger(record.rewardPoints);
    if (rewardPoints <= 0) {
      continue;
    }
    milestones.push({
      id: normalizeMilestoneId(record.id, inviteCount),
      inviteCount,
      rewardPoints,
      enabled: record.enabled !== false,
      description: typeof record.description === 'string' ? record.description.trim().slice(0, 80) : '',
    });
  }

  const sortedMilestones = milestones
    .sort((left, right) => left.inviteCount - right.inviteCount)
    .slice(0, 20);

  const seen = new Set<string>();
  return sortedMilestones.filter((item) => {
    const key = item.id || `invite_${item.inviteCount}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function normalizePointsConfigRecord(
  value: Partial<PointsConfigRecord> | Record<string, unknown> | null | undefined,
): PointsConfigRecord {
  const now = Date.now();
  return {
    configId: POINTS_CONFIG_ID,
    pointsPerYuan: normalizePositiveInteger(value?.pointsPerYuan, DEFAULT_POINTS_PER_YUAN),
    inviteBaseRewardPoints: normalizeNonNegativeInteger(
      value?.inviteBaseRewardPoints,
      DEFAULT_INVITE_BASE_REWARD_POINTS,
    ),
    inviteMilestones: normalizeInviteMilestones(value?.inviteMilestones),
    createdAt: normalizeNonNegativeInteger(value?.createdAt, now),
    updatedAt: normalizeNonNegativeInteger(value?.updatedAt, now),
  };
}

export function getMilestoneKey(milestone: Pick<InviteMilestoneConfig, 'id' | 'inviteCount'>): string {
  return milestone.id || `invite_${milestone.inviteCount}`;
}

export function calculatePointsDeduction(params: {
  readonly price: number;
  readonly availablePoints: number;
  readonly usePointsDeduction: boolean;
  readonly pointsPerYuan: number;
}): PointsDeductionResult {
  const price = Math.max(0, Number(params.price) || 0);
  const pointsPerYuan = normalizePositiveInteger(params.pointsPerYuan, DEFAULT_POINTS_PER_YUAN);
  const availablePoints = Math.max(0, Math.floor(params.availablePoints || 0));
  const maxDeductiblePoints = Math.floor(price * pointsPerYuan);
  const pointsDeducted = params.usePointsDeduction ? Math.min(availablePoints, maxDeductiblePoints) : 0;
  const rawDeductAmount = pointsDeducted / pointsPerYuan;
  const pointsDeductAmount = Number(Math.min(price, rawDeductAmount).toFixed(2));
  return {
    pointsDeducted,
    pointsDeductAmount,
    payableAmount: Number(Math.max(0, price - pointsDeductAmount).toFixed(2)),
  };
}
