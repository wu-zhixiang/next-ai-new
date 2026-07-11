import type { BadgeTone } from '../../components/StatusBadge';
import type { NewsStatus, OrderStatus, ProductStatus, ToolStatus, UserStatus } from '../../types/admin';

interface StatusMeta {
  readonly label: string;
  readonly tone: BadgeTone;
}

export function getUserStatusMeta(status: UserStatus): StatusMeta {
  const map: Record<UserStatus, StatusMeta> = {
    active: { label: '正常', tone: 'success' },
    disabled: { label: '停用', tone: 'danger' },
  };
  return map[status];
}

export function getOrderStatusMeta(status: OrderStatus): StatusMeta {
  const map: Record<OrderStatus, StatusMeta> = {
    pending: { label: '待支付', tone: 'warning' },
    paid: { label: '已支付', tone: 'info' },
    fulfilled: { label: '已交付', tone: 'success' },
    refunded: { label: '已退款', tone: 'neutral' },
    closed: { label: '已关闭', tone: 'danger' },
  };
  return map[status];
}

export function getNewsStatusMeta(status: NewsStatus): StatusMeta {
  const map: Record<NewsStatus, StatusMeta> = {
    draft: { label: '草稿', tone: 'warning' },
    published: { label: '已发布', tone: 'success' },
    archived: { label: '归档', tone: 'neutral' },
  };
  return map[status];
}

export function getToolStatusMeta(status: ToolStatus): StatusMeta {
  const map: Record<ToolStatus, StatusMeta> = {
    enabled: { label: '启用', tone: 'success' },
    disabled: { label: '停用', tone: 'danger' },
    testing: { label: '灰度', tone: 'info' },
  };
  return map[status];
}

export function getProductStatusMeta(status: ProductStatus): StatusMeta {
  const map: Record<ProductStatus, StatusMeta> = {
    on: { label: '上架', tone: 'success' },
    off: { label: '下架', tone: 'neutral' },
  };
  return map[status];
}
