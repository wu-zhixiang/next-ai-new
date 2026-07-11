import { collection } from './db';
import { POINTS_CONFIG_ID, normalizePointsConfigRecord } from './points-config-core';
import type { PointsConfigRecord } from './types';
export {
  DEFAULT_INVITE_BASE_REWARD_POINTS,
  DEFAULT_POINTS_PER_YUAN,
  POINTS_CONFIG_ID,
  calculatePointsDeduction,
  getMilestoneKey,
  normalizeInviteMilestones,
  normalizePointsConfigRecord,
  type PointsDeductionResult,
} from './points-config-core';

function isMissingConfigError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('collection not exists')
    || message.includes('DATABASE_COLLECTION_NOT_EXIST')
    || message.includes('Table not exist')
    || message.includes('document.get:fail')
    || message.includes('cannot find document')
  );
}

export async function getPointsConfig(): Promise<PointsConfigRecord> {
  try {
    const result = await collection('pointsConfig')
      .where({ configId: POINTS_CONFIG_ID })
      .limit(1)
      .get();
    return normalizePointsConfigRecord((result.data[0] as PointsConfigRecord | undefined) ?? null);
  } catch (error) {
    if (isMissingConfigError(error)) {
      return normalizePointsConfigRecord(null);
    }
    throw error;
  }
}
