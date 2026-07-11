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
import type { MemberPlanRecord, ProductStatus } from '../../types/admin';
import { formatDateTime } from '../../utils/format';
import { getProductStatusMeta } from '../shared/statusMeta';

function formatPrice(value: number): string {
  return `¥${Number(value || 0).toLocaleString('zh-CN')}`;
}

export function MemberPlansPage(): JSX.Element {
  const api = useAdminApi();
  const navigate = useNavigate();
  const loader = useCallback(() => api.listPlans(), [api]);
  const remote = useRemoteItems<MemberPlanRecord>('admin.plans', loader);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<ProductStatus | 'all'>('all');
  const [deleteTarget, setDeleteTarget] = useState<MemberPlanRecord | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState('');

  const filteredPlans = useMemo(() => remote.items.filter((plan) => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const keywordMatched = !normalizedKeyword
      || plan.planName.toLowerCase().includes(normalizedKeyword)
      || plan.planCode.toLowerCase().includes(normalizedKeyword)
      || plan.productName.toLowerCase().includes(normalizedKeyword)
      || plan.productCode.toLowerCase().includes(normalizedKeyword);
    const statusMatched = status === 'all' || plan.status === status;
    return keywordMatched && statusMatched;
  }), [remote.items, keyword, status]);

  async function confirmDeletePlan(): Promise<void> {
    if (!deleteTarget) {
      return;
    }
    setIsMutating(true);
    setActionError('');
    try {
      await api.deletePlan(deleteTarget.id);
      await remote.reload({ force: true });
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '删除套餐失败');
    } finally {
      setIsMutating(false);
    }
  }

  const columns: readonly DataTableColumn<MemberPlanRecord>[] = [
    {
      id: 'plan',
      header: '套餐',
      cell: (row) => (
        <div className="title-cell">
          <strong>{row.planName}</strong>
          <span>{row.planCode} / {row.description || row.pid}</span>
        </div>
      ),
    },
    {
      id: 'product',
      header: '商品类型',
      cell: (row) => (
        <div className="title-cell">
          <strong>{row.productName}</strong>
          <span>{row.productCode}</span>
        </div>
      ),
    },
    {
      id: 'paymentProduct',
      header: '支付商品 ID',
      cell: (row) => row.virtualPaymentProductId || '未配置',
    },
    {
      id: 'price',
      header: '价格',
      align: 'right',
      cell: (row) => formatPrice(row.price),
    },
    {
      id: 'duration',
      header: '时长',
      align: 'right',
      cell: (row) => `${row.durationDays} 天`,
    },
    {
      id: 'totalAiPoints',
      header: 'AI积分',
      align: 'right',
      cell: (row) => row.totalAiPoints.toLocaleString('zh-CN'),
    },
    {
      id: 'compliance',
      header: '合规展示',
      cell: (row) => (row.complianceEnabled ? '已启用' : '未启用'),
    },
    {
      id: 'sort',
      header: '排序',
      align: 'right',
      cell: (row) => row.sort,
    },
    {
      id: 'status',
      header: '状态',
      cell: (row) => {
        const meta = getProductStatusMeta(row.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      id: 'updatedAt',
      header: '更新时间',
      cell: (row) => formatDateTime(row.updatedAt),
    },
    {
      id: 'actions',
      header: '操作',
      align: 'right',
      cell: (row) => (
        <div className="table-actions">
          <button className="icon-button" type="button" onClick={() => navigate(`/plans/${encodeURIComponent(row.id)}/edit`)} aria-label="编辑套餐" title="编辑">
            <Pencil size={16} strokeWidth={2} />
          </button>
          <button className="icon-button icon-button--danger" type="button" onClick={() => setDeleteTarget(row)} aria-label="删除套餐" title="删除">
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="套餐配置"
        description="管理会员套餐、价格、支付商品 ID、时长和上下架状态"
        actions={(
          <Button variant="primary" icon={<Plus size={16} strokeWidth={2} />} onClick={() => navigate('/plans/new')}>
            新增套餐
          </Button>
        )}
      />

      <section className="panel">
        <div className="toolbar">
          <label className="search-field">
            <span>搜索套餐</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="套餐名称 / 编码 / 商品类型" />
          </label>
          <label className="select-field">
            <span>状态</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as ProductStatus | 'all')}>
              <option value="all">全部</option>
              <option value="on">上架</option>
              <option value="off">下架</option>
            </select>
          </label>
        </div>
        {actionError ? <div className="inline-error" role="alert">{actionError}</div> : null}
        <PanelState
          errorMessage={remote.errorMessage}
          isEmpty={filteredPlans.length === 0}
          isLoading={remote.isLoading}
          onRetry={remote.reload}
        />
        {!remote.isLoading && !remote.errorMessage ? (
          <DataTable columns={columns} rows={filteredPlans} getRowKey={(row) => row.id} />
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="二次确认删除套餐"
        description={`确认删除套餐「${deleteTarget?.planName ?? ''}」？删除后该套餐配置将从云数据库移除。`}
        isWorking={isMutating}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeletePlan()}
      />
    </div>
  );
}
