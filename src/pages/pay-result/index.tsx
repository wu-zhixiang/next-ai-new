import { useEffect, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { PaymentLockOverlay } from '@/components/PaymentLockOverlay';
import { SaasPageFrame } from '@/components/SaasPageFrame';
import { SkeletonPayResult } from '@/components/Skeleton';
import { callCloudFunction } from '@/services/api';
import { formatDateTime } from '@/utils/format';

interface PayResultData {
  orderNo: string;
  productName?: string;
  planName?: string;
  amount?: number;
  createdAt?: number;
  payStatus: 'pending' | 'paid' | 'failed' | 'closed';
  membership?: {
    status: 'active' | 'expired';
    startAt: number;
    endAt: number;
    remainDays: number;
  };
  pendingExpireAt?: number;
  canPay?: boolean;
}

interface PayOrderResult {
  paid?: boolean;
  message?: string;
  payment?: {
    timeStamp: string;
    nonceStr: string;
    package: string;
    signType: 'MD5' | 'RSA';
    paySign: string;
  };
}

type OrderViewStatus = 'completed' | 'pending' | 'abandoned';
const ORDER_CLOCK_ICON = require('../../assets/icons/order-clock.svg') as string;
const ORDER_ABANDONED_ICON = require('../../assets/icons/order-abandoned.svg') as string;

export default function PayResultPage(): JSX.Element {
  const [data, setData] = useState<PayResultData>({
    orderNo: '',
    payStatus: 'pending',
  });
  const [paymentLocked, setPaymentLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  const showMockButton = process.env.NODE_ENV !== 'production';

  useLoad((options) => {
    const orderNo = options.orderNo ?? '';
    if (orderNo) {
      void loadResult(orderNo);
    }
  });

  useEffect(() => {
    if (!paymentLocked) return;

    Taro.hideTabBar({ animation: false });
    return () => {
      Taro.showTabBar({ animation: false });
    };
  }, [paymentLocked]);

  async function loadResult(orderNo: string): Promise<void> {
    setLoading(true);
    try {
      const result = await callCloudFunction<PayResultData>('get-pay-result', { orderNo });
      setData(result);
    } finally {
      setLoading(false);
    }
  }

  async function handleMockPaid(): Promise<void> {
    if (!data.orderNo) {
      return;
    }
    await callCloudFunction<{ success: true }>('pay-notify', {
      orderNo: data.orderNo,
      transactionId: `mock_${Date.now()}`,
    });
    await loadResult(data.orderNo);
    Taro.showToast({ title: '已模拟支付成功', icon: 'success' });
  }

  async function handlePay(): Promise<void> {
    if (!data.orderNo || !data.canPay) {
      Taro.showToast({ title: '订单不可支付，请重新下单', icon: 'none' });
      return;
    }
    setPaymentLocked(true);
    try {
      const result = await callCloudFunction<PayOrderResult>('pay-order', { orderNo: data.orderNo });
      if (result.paid || !result.payment) {
        await loadResult(data.orderNo);
        return;
      }
      try {
        await Taro.requestPayment({ ...result.payment });
      } finally {
        await loadResult(data.orderNo);
      }
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '支付失败，请稍后再试', icon: 'none' });
    } finally {
      setPaymentLocked(false);
    }
  }

  const orderViewStatus: OrderViewStatus = data.payStatus === 'paid' || data.membership?.status === 'active' ? 'completed' : data.payStatus === 'pending' && data.canPay ? 'pending' : 'abandoned';
  const isPaid = orderViewStatus === 'completed';
  const isPendingPayable = orderViewStatus === 'pending';
  const isAbandoned = orderViewStatus === 'abandoned';
  const remainDays = data.membership?.remainDays ?? (isPaid ? 30 : 0);
  const expiryLabel = formatDateTime(data.membership?.endAt);
  const statusText = isPaid ? '已完成' : isPendingPayable ? '待支付' : '已废弃请重新下单';
  const heroTitle = isPaid ? '订单已完成' : isPendingPayable ? '订单待支付' : '订单已废弃';
  const heroDesc = isPaid ? '高级 AI 能力已成功开启' : isPendingPayable ? '请在 30 分钟内完成支付，超时需重新下单' : '该订单已超过支付有效期，请重新选择套餐下单';
  const heroIconSrc = isPendingPayable ? ORDER_CLOCK_ICON : isAbandoned ? ORDER_ABANDONED_ICON : '';
  const heroIconClass = isPaid ? 'pay-success__icon--success' : isPendingPayable ? 'pay-success__icon--pending' : 'pay-success__icon--abandoned';
  const orderNo = data.orderNo || 'AI-REG-88291032';

  return (
    <SaasPageFrame
      title='服务详情'
      onBack={() => {
        if (paymentLocked) {
          Taro.showToast({ title: '支付处理中，请勿返回', icon: 'none' });
          return;
        }
        const pages = Taro.getCurrentPages();
        if (pages.length > 1) {
          void Taro.navigateBack();
          return;
        }
        void Taro.switchTab({ url: '/pages/records/index' });
      }}
    >
      <View className='pay-detail-page'>

      <View className='saas-shell pay-detail-shell'>
        <View className='saas-shell__inner'>
        {loading ? (
          <SkeletonPayResult />
        ) : (
        <>
        <View className='pay-success'>
          <View className={`pay-success__icon ${heroIconClass}`}>
            {heroIconSrc ? (
              <Image className='pay-success__icon-image' src={heroIconSrc} mode='aspectFit' />
            ) : (
              <Text>✓</Text>
            )}
            <View className='pay-success__ring' />
          </View>
          <Text className='pay-success__title'>{heroTitle}</Text>
          <Text className='pay-success__desc'>{heroDesc}</Text>
        </View>

        <View className='pay-info-card glass-card'>
          <Text className='pay-info-card__title'>服务信息</Text>
          <View className='pay-info-card__rows'>
            <View className='info-row'>
              <Text className='info-row__label'>服务编号</Text>
              <Text className='info-row__value'>{orderNo}</Text>
            </View>
            <View className='info-row'>
              <Text className='info-row__label'>开通时间</Text>
              <Text className='info-row__value'>{isPaid ? formatDateTime(data.membership?.startAt) : formatDateTime(data.createdAt)}</Text>
            </View>
            <View className='info-row'>
              <Text className='info-row__label'>{isPendingPayable ? '支付有效期' : isAbandoned ? '废弃时间' : '到期时间'}</Text>
              <Text className='info-row__value'>{isPendingPayable || isAbandoned ? formatDateTime(data.pendingExpireAt) : expiryLabel}</Text>
            </View>
            <View className='info-row'>
              <Text className='info-row__label'>当前状态</Text>
              <View className='status-pill'>
                <Text className='status-pill__dot' />
                <Text>{statusText}</Text>
              </View>
            </View>
          </View>
        </View>
        </>
        )}

        </View>
      </View>

      {!loading && isPendingPayable ? (
        <View className='pay-bottom-cta'>
          <Button className='saas-button pay-bottom-cta__button' onClick={() => void handlePay()}>
            立即支付
          </Button>
        </View>
      ) : null}
      <PaymentLockOverlay visible={paymentLocked} />
      </View>
    </SaasPageFrame>
  );
}
