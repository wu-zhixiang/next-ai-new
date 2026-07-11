import { BadgeDollarSign, Bot, Newspaper, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '../../components/DataTable';
import { MetricCard } from '../../components/MetricCard';
import { PageHeader } from '../../components/PageHeader';
import { PanelState } from '../../components/PanelState';
import { StatusBadge } from '../../components/StatusBadge';
import { useAdminApi } from '../../hooks/useAdminApi';
import { requestWithDedupe } from '../../services/requestDedupe';
import type { AiNewsRecord, DashboardData, DashboardMetric, OrderRecord } from '../../types/admin';
import { formatCurrency, formatDateTime } from '../../utils/format';
import { getNewsStatusMeta, getOrderStatusMeta } from '../shared/statusMeta';

const metricIcons: Record<string, JSX.Element> = {
  users: <UsersRound size={20} strokeWidth={2} />,
  orders: <BadgeDollarSign size={20} strokeWidth={2} />,
  news: <Newspaper size={20} strokeWidth={2} />,
  tools: <Bot size={20} strokeWidth={2} />,
};

const orderColumns: readonly DataTableColumn<OrderRecord>[] = [
  {
    id: 'orderNo',
    header: '订单号',
    cell: (row) => <strong>{row.orderNo}</strong>,
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
];

const newsColumns: readonly DataTableColumn<AiNewsRecord>[] = [
  {
    id: 'title',
    header: '标题',
    cell: (row) => <strong>{row.title}</strong>,
  },
  {
    id: 'source',
    header: '来源',
    cell: (row) => row.sourceName,
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
];

function renderMetric(metric: DashboardMetric): JSX.Element {
  return (
    <MetricCard
      key={metric.id}
      label={metric.label}
      value={metric.value}
      detail={metric.detail}
      icon={metricIcons[metric.id] ?? metricIcons.users}
    />
  );
}

export function DashboardPage(): JSX.Element {
  const api = useAdminApi();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  const reload = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMessage('');
    try {
      setDashboard(await requestWithDedupe('admin.dashboard', () => api.getDashboard()));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '总览数据加载失败');
    } finally {
      setIsLoading(false);
    }
  }, [api]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return (
    <div className="page-stack">
      <PageHeader title="运营总览" description="关键指标、近期订单与内容发布状态" />

      <PanelState
        errorMessage={errorMessage}
        isEmpty={!dashboard}
        isLoading={isLoading}
        onRetry={reload}
      />

      {!isLoading && !errorMessage && dashboard ? (
        <>
          <div className="metric-grid">
            {dashboard.metrics.map(renderMetric)}
          </div>

          <div className="split-grid">
            <section className="panel">
              <div className="panel-header">
                <h2>近期订单</h2>
              </div>
              <DataTable columns={orderColumns} rows={dashboard.recentOrders} getRowKey={(row) => row.id} />
            </section>

            <section className="panel">
              <div className="panel-header">
                <h2>内容状态</h2>
              </div>
              <DataTable columns={newsColumns} rows={dashboard.recentNews} getRowKey={(row) => row.id} />
            </section>
          </div>
        </>
      ) : null}
    </div>
  );
}
