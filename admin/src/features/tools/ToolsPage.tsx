import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/Button';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { PanelState } from '../../components/PanelState';
import { StatusBadge } from '../../components/StatusBadge';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useRemoteItems } from '../../hooks/useRemoteItems';
import type { AiToolCategory, AiToolRecord, ToolStatus } from '../../types/admin';
import { formatDateTime } from '../../utils/format';
import { getToolStatusMeta } from '../shared/statusMeta';

const categoryLabels: Record<AiToolCategory, string> = {
  text: '文本',
  image: '图像',
  video: '视频',
  workflow: '工作流',
};

export function ToolsPage(): JSX.Element {
  const api = useAdminApi();
  const navigate = useNavigate();
  const loader = useCallback(() => api.listTools(), [api]);
  const remote = useRemoteItems<AiToolRecord>('admin.tools', loader);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<ToolStatus | 'all'>('all');
  const [deleteTarget, setDeleteTarget] = useState<AiToolRecord | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState('');

  const filteredTools = useMemo(() => remote.items.filter((tool) => {
    const keywordMatched = tool.name.toLowerCase().includes(keyword.trim().toLowerCase());
    const statusMatched = status === 'all' || tool.status === status;
    return keywordMatched && statusMatched;
  }), [remote.items, keyword, status]);

  function openEditor(tool: AiToolRecord): void {
    navigate(`/tools/${encodeURIComponent(tool.id)}/edit`);
  }

  async function confirmDeleteTool(): Promise<void> {
    if (!deleteTarget) {
      return;
    }
    setIsMutating(true);
    setActionError('');
    try {
      await api.deleteTool(deleteTarget.id);
      await remote.reload({ force: true });
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '删除工具失败');
    } finally {
      setIsMutating(false);
    }
  }

  const columns: readonly DataTableColumn<AiToolRecord>[] = [
    {
      id: 'name',
      header: '工具',
      cell: (row) => (
        <div className="title-cell">
          <strong>{row.cardTitle || row.name}</strong>
          <span>{row.cardDescription || row.name}</span>
        </div>
      ),
    },
    {
      id: 'category',
      header: '类型',
      cell: (row) => categoryLabels[row.category],
    },
    {
      id: 'runCount',
      header: '调用次数',
      align: 'right',
      cell: (row) => row.runCount.toLocaleString('zh-CN'),
    },
    {
      id: 'pointCost',
      header: '消耗积分',
      align: 'right',
      cell: (row) => row.pointCost,
    },
    {
      id: 'trialLimit',
      header: '体验次数',
      align: 'right',
      cell: (row) => row.trialLimit,
    },
    {
      id: 'updatedAt',
      header: '更新时间',
      cell: (row) => formatDateTime(row.updatedAt),
    },
    {
      id: 'status',
      header: '状态',
      cell: (row) => {
        const meta = getToolStatusMeta(row.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      id: 'actions',
      header: '操作',
      align: 'right',
      cell: (row) => (
        <div className="table-actions">
          <button className="icon-button" type="button" onClick={() => openEditor(row)} aria-label="编辑工具" title="编辑">
            <Pencil size={16} strokeWidth={2} />
          </button>
          <button className="icon-button icon-button--danger" type="button" onClick={() => setDeleteTarget(row)} aria-label="删除工具" title="删除">
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="AI 工具"
        description="工具配置、灰度状态、调用统计与积分消耗"
        actions={(
          <Button variant="primary" icon={<Plus size={16} strokeWidth={2} />} onClick={() => navigate('/tools/new')}>
            新增工具
          </Button>
        )}
      />

      <section className="panel">
        <div className="toolbar">
          <label className="search-field">
            <span>搜索工具</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="工具名称" />
          </label>
          <label className="select-field">
            <span>状态</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as ToolStatus | 'all')}>
              <option value="all">全部</option>
              <option value="enabled">启用</option>
              <option value="testing">灰度</option>
              <option value="disabled">停用</option>
            </select>
          </label>
        </div>
        {actionError ? <div className="inline-error" role="alert">{actionError}</div> : null}
        <PanelState
          errorMessage={remote.errorMessage}
          isEmpty={filteredTools.length === 0}
          isLoading={remote.isLoading}
          onRetry={remote.reload}
        />
        {!remote.isLoading && !remote.errorMessage ? (
          <DataTable columns={columns} rows={filteredTools} getRowKey={(row) => row.id} />
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="二次确认删除工具"
        description={`确认删除工具「${deleteTarget?.name ?? ''}」？删除后该工具后台配置将从云数据库移除。`}
        isWorking={isMutating}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteTool()}
      />
    </div>
  );
}
