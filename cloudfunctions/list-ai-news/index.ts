import { collection } from '../shared/db';
import { ok } from '../shared/utils';
import type { AiNewsRecord, AiNewsView } from '../shared/types';
import { compareAiNewsRecords, getAiNewsPrimarySortField, normalizeAiNewsSort } from '../shared/ai-news-sort';

interface Event {
  limit?: number;
  offset?: number;
  tag?: string;
  sort?: 'hot' | 'latest';
}

interface NewsQuery {
  orderBy(fieldName: string, order: 'asc' | 'desc'): NewsQuery;
  skip(count: number): NewsQuery;
  limit(count: number): NewsQuery;
  get(): Promise<{ data: Array<AiNewsRecord & { _id: string }> }>;
}

function toView(record: AiNewsRecord & { _id: string }): AiNewsView {
  return {
    id: record._id,
    title: record.title,
    summary: record.summary,
    coverFileId: record.coverFileId,
    mediaType: record.mediaType,
    videoFileId: record.videoFileId,
    videoPosterFileId: record.videoPosterFileId,
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

function getCategoryAliases(tag: string): string[] {
  const normalized = normalizeCategory(tag);
  if (normalized === normalizeCategory('AI巨头')) {
    return [
      'AI巨头',
      'OpenAI',
      'Open AI',
      'Google AI',
      'Google',
      'DeepMind',
      'Google DeepMind',
      'Claude AI',
      'Claude',
      'Anthropic',
      'Meta AI',
      'Microsoft AI',
      'xAI',
      'Grok',
    ].map(normalizeCategory);
  }
  if (normalized === normalizeCategory('工具')) {
    return [
      '工具',
      'AI工具',
      '开发者工具',
      'Agent',
      '图片生成',
      '视频生成',
      '办公提效',
      '编程助手',
      '提示词',
      'GitHub',
      'Hugging Face',
    ].map(normalizeCategory);
  }
  if (normalized === normalizeCategory('教程')) {
    return [
      '教程',
      '使用教程',
      '实战教程',
      '入门指南',
      '案例拆解',
      '开发实践',
      '指南',
      '教学',
      'HowTo',
      'Tutorial',
    ].map(normalizeCategory);
  }
  return [normalized];
}

function matchesCategory(record: AiNewsRecord, tag: string): boolean {
  const targets = new Set(getCategoryAliases(tag));
  return (record.tags ?? []).some((item) => targets.has(normalizeCategory(item)));
}

export async function main(event: Event = {}) {
  const limit = Math.max(1, Math.min(Number(event.limit) || 20, 50));
  const offset = Math.max(0, Number(event.offset) || 0);
  const tag = event.tag?.trim();
  const sort = normalizeAiNewsSort(event.sort);
  const sortField = getAiNewsPrimarySortField(sort);
  const pageSize = limit + 1;
  let records: Array<AiNewsRecord & { _id: string }> = [];
  try {
    if (!tag) {
      const result = await (collection('aiNews')
        .where({ status: 'published' }) as unknown as NewsQuery)
        .orderBy(sortField, 'desc')
        .skip(offset)
        .limit(pageSize)
        .get();
      records = result.data;
    } else {
      const matched: Array<AiNewsRecord & { _id: string }> = [];
      let scanned = 0;
      const batchSize = 100;
      const target = offset + pageSize;
      while (matched.length < target) {
        const result = await (collection('aiNews')
          .where({ status: 'published' }) as unknown as NewsQuery)
          .orderBy(sortField, 'desc')
          .skip(scanned)
          .limit(batchSize)
          .get();
        const batch = result.data;
        if (batch.length === 0) {
          break;
        }
        matched.push(...batch.filter((item) => matchesCategory(item, tag)));
        scanned += batch.length;
        if (batch.length < batchSize) {
          break;
        }
      }
      records = matched
        .sort((left, right) => compareAiNewsRecords(sort, left, right))
        .slice(offset, offset + pageSize);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes('collection not exists') || message.includes('DATABASE_COLLECTION_NOT_EXIST') || message.includes('Table not exist')) {
      return ok({ items: [] });
    }
    throw error;
  }

  const items = records
    .slice(0, limit)
    .map(toView);

  return ok({
    items,
    hasMore: records.length > limit,
    total: offset + items.length + (records.length > limit ? 1 : 0),
  });
}
