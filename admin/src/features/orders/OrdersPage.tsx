import { Pencil, Trash2 } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { PageHeader } from '../../components/PageHeader';
import { PanelState } from '../../components/PanelState';
import { StatusBadge } from '../../components/StatusBadge';
import { useAdminApi } from '../../hooks/useAdminApi';
import { useRemoteItems } from '../../hooks/useRemoteItems';
import type { OrderRecord, OrderStatus, OrderUpdateInput } from '../../types/admin';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { getOrderStatusMeta } from '../shared/statusMeta';
import { OrderEditor } from './OrderEditor';

export function OrdersPage(): JSX.Element {
  const api = useAdminApi();
  const loader = useCallback(() => api.listOrders(), [api]);
  const remote = useRemoteItems<OrderRecord>('admin.orders', loader);
  const [keyword, setKeyword] = useState('');
  const [status, setStatus] = useState<OrderStatus | 'all'>('all');
  const [editorOpen, setEditorOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderRecord | null>(null);
  const [isMutating, setIsMutating] = useState(false);
  const [actionError, setActionError] = useState('');

  const filteredOrders = useMemo(() => remote.items.filter((order) => {
    const targetText = `${order.orderNo} ${order.userName} ${order.productName}`.toLowerCase();
    const keywordMatched = targetText.includes(keyword.trim().toLowerCase());
    const statusMatched = status === 'all' || order.status === status;
    return keywordMatched && statusMatched;
  }), [remote.items, keyword, status]);

  function openEditor(order: OrderRecord): void {
    setSelectedOrder(order);
    setEditorOpen(true);
  }

  async function submitOrder(orderId: string, input: OrderUpdateInput): Promise<void> {
    setIsMutating(true);
    setActionError('');
    try {
      const nextItems = await api.updateOrder(orderId, input);
      remote.setItems(nextItems);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '保存订单失败');
    } finally {
      setIsMutating(false);
    }
  }

  async function confirmDeleteOrder(): Promise<void> {
    if (!deleteTarget) {
      return;
    }
    setIsMutating(true);
      setActionError('');
      try {
        await api.deleteOrder(deleteTarget.id);
      await remote.reload({ force: true });
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '删除订单失败');
    } finally {
      setIsMutating(false);
    }
  }

  const columns: readonly DataTableColumn<OrderRecord>[] = [
    {
      id: 'orderNo',
      header: '订单号',
      cell: (row) => <strong>{row.orderNo}</strong>,
    },
    {
      id: 'user',
      header: '用户',
      cell: (row) => row.userName,
    },
    {
      id: 'product',
      header: '产品',
      cell: (row) => row.productName,
    },
    {
      id: 'amount',
      header: '金额',
      align: 'right',
      cell: (row) => formatCurrency(row.amountCents),
    },
    {
      id: 'status',
      header: '状态',
      cell: (row) => {
        const meta = getOrderStatusMeta(row.status);
        return <StatusBadge label={meta.label} tone={meta.tone} />;
      },
    },
    {
      id: 'paidAt',
      header: '支付时间',
      cell: (row) => formatDateTime(row.paidAt),
    },
    {
      id: 'actions',
      header: '操作',
      align: 'right',
      cell: (row) => (
        <div className="table-actions">
          <button className="icon-button" type="button" onClick={() => openEditor(row)} aria-label="编辑订单" title="编辑">
            <Pencil size={16} strokeWidth={2} />
          </button>
          <button className="icon-button icon-button--danger" type="button" onClick={() => setDeleteTarget(row)} aria-label="删除订单" title="删除">
            <Trash2 size={16} strokeWidth={2} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        title="订单管理"
        description="订单检索、支付状态、交付状态与人工处理"
      />

      <section className="panel">
        <div className="toolbar">
          <label className="search-field">
            <span>搜索订单</span>
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="订单号 / 用户 / 产品" />
          </label>
          <label className="select-field">
            <span>状态</span>
            <select value={status} onChange={(event) => setStatus(event.target.value as OrderStatus | 'all')}>
              <option value="all">全部</option>
              <option value="pending">待支付</option>
              <option value="paid">已支付</option>
              <option value="fulfilled">已交付</option>
              <option value="refunded">已退款</option>
              <option value="closed">已关闭</option>
            </select>
          </label>
        </div>
        {actionError ? <div className="inline-error" role="alert">{actionError}</div> : null}
        <PanelState
          errorMessage={remote.errorMessage}
          isEmpty={filteredOrders.length === 0}
          isLoading={remote.isLoading}
          onRetry={remote.reload}
        />
        {!remote.isLoading && !remote.errorMessage ? (
          <DataTable columns={columns} rows={filteredOrders} getRowKey={(row) => row.id} />
        ) : null}
      </section>

      <OrderEditor
        open={editorOpen}
        order={selectedOrder}
        onClose={() => setEditorOpen(false)}
        onSubmit={(orderId, input) => void submitOrder(orderId, input)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="二次确认删除订单"
        description={`确认删除订单「${deleteTarget?.orderNo ?? ''}」？删除后该订单后台记录将从云数据库移除。`}
        isWorking={isMutating}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDeleteOrder()}
      />
    </div>
  );
}
