import { collection, ensureCollection } from '../shared/db';
import {
  buildDefaultAiToolRecord,
  getDefaultAdminToolDefinitions,
  normalizeAiToolSortOrder,
  toPublicAiToolView,
  type AiToolConfigRecord,
  type AiToolPublicView,
} from '../shared/ai-tool-config';
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

export async function main() {
  const records = await readToolRecords();
  const data: AiToolPublicView[] = mergeDefaultToolRecords(records)
    .map(toPublicAiToolView)
    .filter((tool) => tool.visible)
    .sort((left, right) => normalizeAiToolSortOrder(left.sortOrder, 999) - normalizeAiToolSortOrder(right.sortOrder, 999));
  return ok(data);
}
