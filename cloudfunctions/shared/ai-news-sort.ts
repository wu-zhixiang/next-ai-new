import type { AiNewsRecord } from './types';

export type AiNewsSortMode = 'hot' | 'latest';

export function normalizeAiNewsSort(value?: string): AiNewsSortMode {
  return value === 'latest' ? 'latest' : 'hot';
}

export function getAiNewsPrimarySortField(sort: AiNewsSortMode): 'score' | 'publishedAt' {
  return sort === 'latest' ? 'publishedAt' : 'score';
}

export function compareAiNewsRecords(sort: AiNewsSortMode, left: AiNewsRecord, right: AiNewsRecord): number {
  const leftTime = left.publishedAt || left.createdAt || 0;
  const rightTime = right.publishedAt || right.createdAt || 0;
  if (sort === 'latest') {
    return rightTime - leftTime;
  }

  const scoreDiff = (right.score || 0) - (left.score || 0);
  return scoreDiff || rightTime - leftTime;
}
