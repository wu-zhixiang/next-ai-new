import assert from 'node:assert/strict';
import test from 'node:test';

import { compareAiNewsRecords, getAiNewsPrimarySortField, normalizeAiNewsSort } from '../cloudfunctions/shared/ai-news-sort.ts';
import type { AiNewsRecord } from '../cloudfunctions/shared/types.ts';

function news(overrides: Partial<AiNewsRecord>): AiNewsRecord {
  return {
    title: '',
    summary: '',
    contentMarkdown: '',
    sourceName: 'AIO',
    sourcePlatform: 'manual',
    tags: [],
    viewCount: 0,
    likeCount: 0,
    repostCount: 0,
    commentCount: 0,
    score: 0,
    status: 'published',
    publishedAt: 0,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

test('latest news sorting uses publishedAt first', () => {
  const items = [
    news({ title: 'older', publishedAt: 100, score: 999 }),
    news({ title: 'newer', publishedAt: 300, score: 1 }),
  ].sort((left, right) => compareAiNewsRecords('latest', left, right));

  assert.equal(items[0].title, 'newer');
});

test('hot news sorting uses score and falls back to newest time', () => {
  const items = [
    news({ title: 'older-same-score', publishedAt: 100, score: 50 }),
    news({ title: 'higher-score', publishedAt: 1, score: 100 }),
    news({ title: 'newer-same-score', publishedAt: 300, score: 50 }),
  ].sort((left, right) => compareAiNewsRecords('hot', left, right));

  assert.deepEqual(items.map((item) => item.title), ['higher-score', 'newer-same-score', 'older-same-score']);
});

test('news sort mode maps to the database primary sort field', () => {
  assert.equal(normalizeAiNewsSort('latest'), 'latest');
  assert.equal(normalizeAiNewsSort('unknown'), 'hot');
  assert.equal(getAiNewsPrimarySortField('latest'), 'publishedAt');
  assert.equal(getAiNewsPrimarySortField('hot'), 'score');
});
