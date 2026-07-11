import {
  BadgeDollarSign,
  Bot,
  Coins,
  FileUp,
  LayoutDashboard,
  ListChecks,
  Newspaper,
  Package,
  UsersRound,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavigationItem {
  readonly label: string;
  readonly path: string;
  readonly icon: LucideIcon;
}

export const navigationItems: readonly NavigationItem[] = [
  {
    label: '总览',
    path: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    label: '用户',
    path: '/users',
    icon: UsersRound,
  },
  {
    label: '订单',
    path: '/orders',
    icon: BadgeDollarSign,
  },
  {
    label: '商品类型',
    path: '/product-types',
    icon: Package,
  },
  {
    label: '套餐配置',
    path: '/plans',
    icon: ListChecks,
  },
  {
    label: '积分配置',
    path: '/points-config',
    icon: Coins,
  },
  {
    label: '文件管理',
    path: '/files',
    icon: FileUp,
  },
  {
    label: 'AI 新闻',
    path: '/news',
    icon: Newspaper,
  },
  {
    label: 'AI 工具',
    path: '/tools',
    icon: Bot,
  },
];
