import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { PanelState } from '../../components/PanelState';
import { StatusBadge } from '../../components/StatusBadge';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useRemoteItems } from '../../hooks/useRemoteItems';
import type { AiNewsInput, AiNewsRecord, NewsStatus } from '../../types/admin';
import { formatDateTime } from '../../utils/format';
import { getNewsStatusMeta } from '../shared/statusMeta';
import { NewsEditor } from './NewsEditor';

export function NewsPage(): JSX.Element {
  const api = useAdminApi();
  const loader = useCallback(() => api.listNews(), [api]);
  const remote = useRemoteItems<AiNewsRecord>('admin.news', loader);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<NewsStatus | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedNews, setSelectedNews] = useState<AiNewsRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AiNewsRecord | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState('');

  const filteredNews = useMemo(() => remote.items.filter((news) => {
    const targetText = `${news.title} ${news.sourceName} ${news.summary}`.toLowerCase();
    const keywordMatched = targetText.includes(keyword.trim().toLowerCase());
    const statusMatched = status === 'all' || news.status === status;
    return keywordMatched && statusMatched;
  }), [remote.items, keyword, status]);

  function openEditor(news: AiNewsRecord | null): void {
    setSelectedNews(news);
    setEditorOpen(true);
  }

  async function submitNews(input: AiNewsInput): Promise<void> {
    setIsMutating(true);
    setActionError('');
    try {
      const nextItems = selectedNews
        ? await api.updateNews(selectedNews.id, input)
        : await api.createNews(input);
      remote.setItems(nextItems);
      setEditorOpen(false);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '保存资讯失败');
    } finally {
      setIsMutating(false);
    }
  }

  async function confirmDeleteNews(): Promise<void> {
    if (!deleteTarget) {
      return;
    }
    setIsMutating(true);
      setActionError('');
      try {
        await api.deleteNews(deleteTarget.id);
      await remote.reload({ force: true });
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '删除资讯失败');
    } finally {
      setIsMutating(false);
    }
  }

  const columns: readonly DataTableColumn<AiNewsRecord>[] = [
    {
      id: 'title',
      header: '标题',
      cell: (row) => (
        <div className="title-cell">
          <strong>{row.title}</strong>
          <span>{row.summary}</span>
        </div>
      ),
    },
    {
      id: 'source',
      header: '来源',
      cell: (row) => row.sourceName,
    },
    {
      id: 'views',
      header: '浏览',
      align: 'right',
      cell: (row) => row.viewCount,
    },
    {
      id: 'publishAt',
      header: '发布时间',
      cell: (row) => formatDateTime(row.publishAt),
    },
    {
      id: 'status',
      header: '状态',
      cell: (row) => {
        const meta = getNewsStatusMeta(row.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      id: 'actions',
      header: '操作',
      align: 'right',
      cell: (row) => (
        <div className="table-actions">
          <button className="icon-button" type="button" onClick={() => openEditor(row)} aria-label="编辑资讯" title="编辑">
            <Pencil size={16} strokeWidth={2} />
          </button>
          <button className="icon-button icon-button--danger" type="button" onClick={() => setDeleteTarget(row)} aria-label="删除资讯" title="删除">
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="AI 新闻"
        description="资讯素材、发布状态、来源与摘要维护"
        actions={(
          <Button variant="primary" icon={<Plus size={16} strokeWidth={2} />} onClick={() => openEditor(null)}>
            新增资讯
          </Button>
        )}
      />

      <section className="panel">
        <div className="toolbar">
          <label className="search-field">
            <span>搜索资讯</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="标题 / 来源 / 摘要" />
          </label>
          <label className="select-field">
            <span>状态</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as NewsStatus | 'all')}>
              <option value="all">全部</option>
              <option value="draft">草稿</option>
              <option value="published">已发布</option>
              <option value="archived">归档</option>
            </select>
          </label>
        </div>
        {actionError ? <div className="inline-error" role="alert">{actionError}</div> : null}
        <PanelState
          errorMessage={remote.errorMessage}
          isEmpty={filteredNews.length === 0}
          isLoading={remote.isLoading}
          onRetry={remote.reload}
        />
        {!remote.isLoading && !remote.errorMessage ? (
          <DataTable columns={columns} rows={filteredNews} getRowKey={(row) => row.id} />
        ) : null}
      </section>

      <NewsEditor
        open={editorOpen}
        news={selectedNews}
        onClose={() => setEditorOpen(false)}
        onSubmit={(input) => void submitNews(input)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="二次确认删除资讯"
        description={`确认删除资讯「${deleteTarget?.title ?? ''}」？删除后该资讯后台记录将从云数据库移除。`}
        isWorking={isMutating}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteNews()}
      />
    </div>
  );
}
