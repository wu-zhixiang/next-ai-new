import { collection } from '../shared/db';
import { ok } from '../shared/utils';
import type { AiNewsRecord, AiNewsView } from '../shared/types';

interface Event {
  limit?: number;
  tag?: string;
  sort?: 'hot' | 'latest';
}

function toView(record: AiNewsRecord & { _id: string }): AiNewsView {
  return {
    id: record._id,
    title: record.title,
    summary: record.summary,
    coverFileId: record.coverFileId,
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    authorName: record.authorName,
    sourcePlatform: record.sourcePlatform,
    tags: record.tags ?? [],
    heat: Math.max(0, Math.round(record.score || record.viewCount || 0)),
    publishedAt: record.publishedAt,
  };
}

function normalizeCategory(value: string): string {
  return value.toLowerCase().replace(/[\s_-]+/g, '');
}

function matchesCategory(record: AiNewsRecord, tag: string): boolean {
  const target = normalizeCategory(tag);
  return (record.tags ?? []).some((item) => normalizeCategory(item) === target);
}

export async function main(event: Event = {}) {
  const limit = Math.max(1, Math.min(Number(event.limit) || 20, 50));
  let result: { data: Array<AiNewsRecord & { _id: string }> };
  try {
    result = await collection('aiNews')
      .where({
        status: 'published',
      })
      .get() as { data: Array<AiNewsRecord & { _id: string }> };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('collection not exists') || message.includes('DATABASE_COLLECTION_NOT_EXIST') || message.includes('Table not exist')) {
      return ok({ items: [] });
    }
    throw error;
  }

  const tag = event.tag?.trim();
  const sort = event.sort === 'latest' ? 'latest' : 'hot';
  const items = result.data
    .filter((item) => !tag || matchesCategory(item, tag))
    .sort((left, right) => {
      if (sort === 'latest') {
        return (right.publishedAt || right.createdAt) - (left.publishedAt || left.createdAt);
      }
      const scoreDiff = (right.score || 0) - (left.score || 0);
      return scoreDiff || (right.publishedAt || right.createdAt) - (left.publishedAt || left.createdAt);
    })
    .slice(0, limit)
    .map(toView);

  return ok({ items });
}
