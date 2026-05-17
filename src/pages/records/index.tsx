import { useState } from 'react';
import { Image, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { SaasPageFrame } from '@/components/SaasPageFrame';
import { SkeletonOrderList } from '@/components/Skeleton';
import { callCloudFunction } from '@/services/api';
import { formatDateTime } from '@/utils/format';

const CHEVRON_RIGHT_ICON = require('../../assets/icons/chevron-right.svg') as string;

type PayStatus = 'pending' | 'paid' | 'failed' | 'closed' | 'refunded';

interface OrderItem {
  orderNo: string;
  productName: string;
  planName: string;
  amount: number;
  durationDays: number;
  payStatus: PayStatus;
  createdAt: number;
  paidAt?: number;
  pendingExpireAt?: number;
  canPay?: boolean;
}

interface ListOrdersResult {
  orders: OrderItem[];
}

const STATUS_LABEL: Record<PayStatus, string> = {
  pending: '待支付',
  paid: '已完成',
  failed: '已废弃请重新下单',
  closed: '已废弃请重新下单',
  refunded: '已退款',
};

function getOrderStatusLabel(order: OrderItem): string {
  if (order.payStatus === 'pending' && !order.canPay) {
    return '已废弃请重新下单';
  }
  return STATUS_LABEL[order.payStatus];
}

export default function RecordsPage(): JSX.Element {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useDidShow(() => {
    void loadOrders();
  });

  async function loadOrders(): Promise<void> {
    setLoading(true);
    try {
      const result = await callCloudFunction<ListOrdersResult>('list-orders');
      setOrders(result.orders);
    } finally {
      setLoading(false);
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
                    <Text className='record-card__title'>{item.planName}</Text>
                  </View>
                  <View className={`status-pill status-pill--${item.payStatus}`}>
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
