import { collection } from '../shared/db';
import { ok } from '../shared/utils';
import type { AiNewsDetailView, AiNewsRecord } from '../shared/types';

interface Event {
  id?: string;
}

function toView(record: AiNewsRecord & { _id: string }): AiNewsDetailView {
  return {
    id: record._id,
    title: record.title,
    summary: record.summary,
    coverFileId: record.coverFileId,
    contentMarkdown: record.contentMarkdown,
    sourceName: record.sourceName,
    sourceUrl: record.sourceUrl,
    authorName: record.authorName,
    sourcePlatform: record.sourcePlatform,
    tags: record.tags ?? [],
    heat: Math.max(0, Math.round(record.score || record.viewCount || 0)),
    publishedAt: record.publishedAt,
  };
}

export async function main(event: Event = {}) {
  const id = event.id?.trim();
  if (!id) {
    throw new Error('缺少资讯 ID');
  }

  const result = await collection('aiNews').doc(id).get();
  const record = result.data as (AiNewsRecord & { _id: string }) | undefined;
  if (!record || record.status !== 'published') {
    throw new Error('资讯不存在或未发布');
  }

  return ok(toView(record));
}
