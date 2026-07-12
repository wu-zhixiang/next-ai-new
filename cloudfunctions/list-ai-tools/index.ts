import { getWxContext } from '../_lib/context';
import { collection, ensureCollection, getUserByOpenId } from '../shared/db';
import {
  buildDefaultAiToolRecord,
  getDefaultAdminToolDefinitions,
  normalizeAiToolSortOrder,
  toPublicAiToolView,
  type AiToolConfigRecord,
  type AiToolPublicView,
} from '../shared/ai-tool-config';
import type { AiToolUserUsageRecord } from '../shared/types';
import { ok } from '../shared/utils';

function isMissingToolsCollectionError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes('collection not exists')
    || message.includes('DATABASE_COLLECTION_NOT_EXIST')
    || message.includes('Table not exist')
  );
}

async function readToolRecords(): Promise<Array<AiToolConfigRecord & { _id: string }>> {
  try {
    await ensureCollection('aiTools');
    const result = await collection('aiTools').get();
    return result.data as Array<AiToolConfigRecord & { _id: string }>;
  } catch (error) {
    if (isMissingToolsCollectionError(error)) {
      return [];
    }
    throw error;
  }
}

function findOverrideRecord(
  records: readonly (AiToolConfigRecord & { _id: string })[],
  toolId: string,
): (AiToolConfigRecord & { _id: string }) | undefined {
  return records.find((record) => record.toolId === toolId || record._id === toolId);
}

function mergeDefaultToolRecords(
  records: readonly (AiToolConfigRecord & { _id: string })[],
): Array<AiToolConfigRecord & { _id: string }> {
  return getDefaultAdminToolDefinitions()
    .map((definition) => {
      const base = buildDefaultAiToolRecord(definition);
      const override = findOverrideRecord(records, definition.toolId);
      if (override?.deleted) {
        return null;
      }
      return override
        ? {
          ...base,
          ...override,
          _id: override._id,
          toolId: definition.toolId,
          builtIn: true,
        }
        : base;
    })
    .filter((record): record is AiToolConfigRecord & { _id: string } => Boolean(record));
}

async function readUserToolUsageByToolId(): Promise<Map<string, AiToolUserUsageRecord>> {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    return new Map();
  }
  try {
    await ensureCollection('aiToolUserUsage');
    const result = await collection('aiToolUserUsage').where({ userId: user._id }).get();
    return new Map(
      (result.data as AiToolUserUsageRecord[])
        .filter((record) => Boolean(record.toolId))
        .map((record) => [record.toolId, record]),
    );
  } catch (error) {
    if (isMissingToolsCollectionError(error)) {
      return new Map();
    }
    throw error;
  }
}

export async function main() {
  const [records, usageByToolId] = await Promise.all([
    readToolRecords(),
    readUserToolUsageByToolId(),
  ]);
  const data: AiToolPublicView[] = mergeDefaultToolRecords(records)
    .map((record) => {
      const tool = toPublicAiToolView(record);
      const usage = usageByToolId.get(tool.toolId);
      return {
        ...tool,
        trialRemaining: Math.max(0, tool.trialLimit - Math.max(0, Math.floor(Number(usage?.trialUsed ?? 0)))),
      };
    })
    .filter((tool) => tool.visible)
    .sort((left, right) => normalizeAiToolSortOrder(left.sortOrder, 999) - normalizeAiToolSortOrder(right.sortOrder, 999));
  return ok(data);
}
