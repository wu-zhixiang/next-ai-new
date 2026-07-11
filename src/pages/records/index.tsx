import { useEffect, useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import { SaasPageFrame } from '@/components/SaasPageFrame';
import { SkeletonOrderList } from '@/components/Skeleton';
import { callCloudFunction } from '@/services/api';
import { formatDateTime } from '@/utils/format';
import { showTabBarSafely } from '@/utils/tabbar';
import { useResetPageScroll } from '@/hooks/useResetPageScroll';
import { loadClientAppConfig } from '@/utils/appConfig';
import { getCompliantOrderDisplay } from '@/utils/productCompliance';
import type { PlanView, ProductTypeView } from '@/types';

const CHEVRON_RIGHT_ICON = require('../../assets/icons/chevron-right.svg') as string;

type PayStatus = 'pending' | 'paid' | 'failed' | 'closed' | 'refunded';

interface OrderItem {
  orderNo: string;
  productCode?: string;
  planCode?: string;
  productName: string;
  planName: string;
  orderType?: 'purchase' | 'renew' | 'tool_single';
  toolName?: string;
  toolPointCost?: number;
  amount: number;
  durationDays: number;
  payStatus: PayStatus;
  fulfillmentStatus?: 'pending' | 'opening' | 'fulfilled' | 'failed';
  createdAt: number;
  paidAt?: number;
  pendingExpireAt?: number;
  canPay?: boolean;
}

interface ListOrdersResult {
  orders: OrderItem[];
}

interface ProductTypeListResult {
  productTypes: ProductTypeView[];
}

interface PlanListResult {
  plans: PlanView[];
}

const STATUS_LABEL: Record<PayStatus, string> = {
  pending: '待支付',
  paid: '已完成',
  failed: '已废弃',
  closed: '已废弃',
  refunded: '已退款',
};

function getOrderStatusLabel(order: OrderItem): string {
  if (order.fulfillmentStatus === 'opening') {
    return '开通中';
  }
  if (order.payStatus === 'pending' && !order.canPay) {
    return '已废弃';
  }
  return STATUS_LABEL[order.payStatus];
}

export default function RecordsPage(): JSX.Element {
  useResetPageScroll();

  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    showTabBarSafely();
  });

  useEffect(() => {
    void loadOrders();
  }, []);

  usePullDownRefresh(() => {
    void refreshOrders();
  });

  async function loadOrders(showLoading = true): Promise<void> {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const [config, result, productResult, planResult] = await Promise.all([
        loadClientAppConfig(),
        callCloudFunction<ListOrdersResult>('list-orders'),
        callCloudFunction<ProductTypeListResult>('list-product-types').catch(() => ({ productTypes: [] })),
        callCloudFunction<PlanListResult>('list-member-plans').catch(() => ({ plans: [] })),
      ]);
      setOrders(
        config.enableProductComplianceMode
          ? result.orders.map((order) => {
              if (order.orderType === 'tool_single') {
                return order;
              }
              const display = getCompliantOrderDisplay(
                order.productCode,
                order.planCode,
                productResult.productTypes,
                planResult.plans,
                {
                  productName: order.productName,
                  planName: order.planName,
                },
              );
              return {
                ...order,
                ...display,
              };
            })
          : result.orders,
      );
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '服务记录刷新失败',
        icon: 'none',
      });
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  async function refreshOrders(): Promise<void> {
    try {
      await loadOrders(false);
    } finally {
      Taro.stopPullDownRefresh();
    }
  }

  function openDetail(orderNo: string): void {
    Taro.navigateTo({ url: `/pages/pay-result/index?orderNo=${orderNo}` });
  }

  return (
    <SaasPageFrame title='服务记录' showBack={false}>
      <View className='records-page'>
        <View className='saas-shell records-shell'>
          {loading ? (
            <SkeletonOrderList count={3} />
          ) : orders.length === 0 ? (
            <View className='record-card record-card--empty'>
              <Text className='record-card__title'>暂无服务记录</Text>
              <Text className='record-card__hint'>购买会员后，订单与服务状态会展示在这里</Text>
            </View>
          ) : (
            orders.map((item) => (
              <View key={item.orderNo} className='record-card'>
                <View className='record-card__head'>
                  <View>
                    <Text className='record-card__tier'>{item.productName}</Text>
                    <Text className='record-card__title'>{item.orderType === 'tool_single' ? item.toolName ?? item.planName : item.planName}</Text>
                  </View>
                  <View className={`status-pill status-pill--${item.fulfillmentStatus === 'opening' ? 'opening' : item.payStatus}`}>
                    <Text className='status-pill__dot' />
                    <Text>{getOrderStatusLabel(item)}</Text>
                  </View>
                </View>
                <View className='record-card__rows'>
                  <View className='info-row'>
                    <Text className='info-row__label'>订单编号</Text>
                    <Text className='info-row__value'>{item.orderNo}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='info-row__label'>下单时间</Text>
                    <Text className='info-row__value'>{formatDateTime(item.createdAt)}</Text>
                  </View>
                  <View className='info-row'>
                    <Text className='info-row__label'>订单金额</Text>
                    <Text className='info-row__value'>¥{item.amount.toFixed(2)}</Text>
                  </View>
                  {item.payStatus === 'pending' ? (
                    <View className='info-row'>
                      <Text className='info-row__label'>支付有效期</Text>
                      <Text className='info-row__value'>{item.canPay ? `${formatDateTime(item.pendingExpireAt)} 前` : '已废弃'}</Text>
                    </View>
                  ) : null}
                </View>
                <View className='record-card__action' onClick={() => openDetail(item.orderNo)}>
                  <Text>{item.payStatus === 'pending' && item.canPay ? '去支付' : '查看服务详情'}</Text>
                  <Image className='record-card__arrow' src={CHEVRON_RIGHT_ICON} mode='aspectFit' />
                </View>
              </View>
            ))
          )}
        </View>
      </View>
    </SaasPageFrame>
  );
}
