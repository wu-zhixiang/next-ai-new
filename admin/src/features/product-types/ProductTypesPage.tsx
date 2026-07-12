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
import type { ProductStatus, ProductTypeRecord } from '../../types/admin';
import { formatDateTime } from '../../utils/format';
import { getProductStatusMeta } from '../shared/statusMeta';

export function ProductTypesPage(): JSX.Element {
  const api = useAdminApi();
  const navigate = useNavigate();
  const loader = useCallback(() => api.listProductTypes(), [api]);
  const remote = useRemoteItems<ProductTypeRecord>('admin.product-types', loader);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<ProductStatus | 'all'>('all');
  const [deleteTarget, setDeleteTarget] = useState<ProductTypeRecord | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState('');

  const filteredProducts = useMemo(() => remote.items.filter((product) => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const keywordMatched = !normalizedKeyword
      || product.productName.toLowerCase().includes(normalizedKeyword)
      || product.productCode.toLowerCase().includes(normalizedKeyword)
      || product.label.toLowerCase().includes(normalizedKeyword);
    const statusMatched = status === 'all' || product.status === status;
    return keywordMatched && statusMatched;
  }), [remote.items, keyword, status]);

  async function confirmDeleteProduct(): Promise<void> {
    if (!deleteTarget) {
      return;
    }
    setIsMutating(true);
    setActionError('');
    try {
      await api.deleteProductType(deleteTarget.id);
      await remote.reload({ force: true });
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '删除商品类型失败');
    } finally {
      setIsMutating(false);
    }
  }

  const columns: readonly DataTableColumn<ProductTypeRecord>[] = [
    {
      id: 'product',
      header: '商品类型',
      cell: (row) => (
        <div className="title-cell">
          <strong>{row.productName}</strong>
          <span>{row.productCode} / {row.description || row.label}</span>
        </div>
      ),
    },
    {
      id: 'label',
      header: '小程序展示',
      cell: (row) => (
        <div className="title-cell">
          <strong>{row.label}</strong>
          <span>{row.tag || '未配置标签'}</span>
        </div>
      ),
    },
    {
      id: 'available',
      header: '可选',
      cell: (row) => <StatusBadge label={row.available ? '可选择' : '不可选'} tone={row.available ? 'success' : 'neutral'} />,
    },
    {
      id: 'fulfillmentMode',
      header: '生效方式',
      cell: (row) => (
        <StatusBadge
          label={row.fulfillmentMode === 'manual' ? '人工开通' : '立即生效'}
          tone={row.fulfillmentMode === 'manual' ? 'warning' : 'success'}
        />
      ),
    },
    {
      id: 'sort',
      header: '排序',
      align: 'right',
      cell: (row) => row.sort,
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
        const meta = getProductStatusMeta(row.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      id: 'actions',
      header: '操作',
      align: 'right',
      cell: (row) => (
        <div className="table-actions">
          <button className="icon-button" type="button" onClick={() => navigate(`/product-types/${encodeURIComponent(row.id)}/edit`)} aria-label="编辑商品类型" title="编辑">
            <Pencil size={16} strokeWidth={2} />
          </button>
          <button className="icon-button icon-button--danger" type="button" onClick={() => setDeleteTarget(row)} aria-label="删除商品类型" title="删除">
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="商品类型"
        description="管理小程序商品入口、介绍信息、合规展示和上下架状态"
        actions={(
          <Button variant="primary" icon={<Plus size={16} strokeWidth={2} />} onClick={() => navigate('/product-types/new')}>
            新增商品类型
          </Button>
        )}
      />

      <section className="panel">
        <div className="toolbar">
          <label className="search-field">
            <span>搜索商品</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="商品名称 / 编码 / 展示名" />
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
          isEmpty={filteredProducts.length === 0}
          isLoading={remote.isLoading}
          onRetry={remote.reload}
        />
        {!remote.isLoading && !remote.errorMessage ? (
          <DataTable columns={columns} rows={filteredProducts} getRowKey={(row) => row.id} />
        ) : null}
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="二次确认删除商品类型"
        description={`确认删除商品类型「${deleteTarget?.productName ?? ''}」？删除后相关商品入口配置将从云数据库移除。`}
        isWorking={isMutating}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteProduct()}
      />
    </div>
  );
}
