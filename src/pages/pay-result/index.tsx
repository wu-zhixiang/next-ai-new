import { useEffect, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { PaymentLockOverlay } from '@/components/PaymentLockOverlay';
import { SaasPageFrame } from '@/components/SaasPageFrame';
import { SkeletonPayResult } from '@/components/Skeleton';
import { callCloudFunction } from '@/services/api';
import { formatDateTime } from '@/utils/format';
import { createPayOrderPayload, MiniProgramPaymentError, requestMiniProgramPayment, type PayOrderResult } from '@/utils/payment';
import { hideTabBarSafely, showTabBarSafely } from '@/utils/tabbar';

interface PayResultData {
  orderNo: string;
  productName?: string;
  planName?: string;
  amount?: number;
  originalAmount?: number;
  pointsDeducted?: number;
  pointsDeductAmount?: number;
  createdAt?: number;
  payStatus: 'pending' | 'paid' | 'failed' | 'closed';
  fulfillmentStatus?: 'pending' | 'opening' | 'fulfilled' | 'failed';
  paidAt?: number;
  fulfilledAt?: number;
  membership?: {
    status: 'opening' | 'active' | 'expired' | 'cancelled';
    startAt?: number;
    endAt?: number;
    remainDays?: number;
  };
  pendingExpireAt?: number;
  canPay?: boolean;
}

interface RetryOrderResult {
  orderNo: string;
}

type OrderViewStatus = 'completed' | 'opening' | 'pending' | 'abandoned';
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

    hideTabBarSafely();
    return () => {
      showTabBarSafely();
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
      const retry = await callCloudFunction<RetryOrderResult>('retry-order', { orderNo: data.orderNo });
      const nextOrderNo = retry.orderNo;
      const result = await callCloudFunction<PayOrderResult>('pay-order', await createPayOrderPayload(nextOrderNo));
      if (result.paid || !result.payment && !result.virtualPayment) {
        await loadResult(nextOrderNo);
        return;
      }
      try {
        await requestMiniProgramPayment(result);
      } finally {
        await loadResult(nextOrderNo);
      }
    } catch (error) {
      if (error instanceof MiniProgramPaymentError && error.code === 'ORDER_CLOSED') {
        await loadResult(data.orderNo);
      }
      Taro.showToast({ title: error instanceof Error ? error.message : '支付失败，请稍后再试', icon: 'none' });
    } finally {
      setPaymentLocked(false);
    }
  }

  const orderViewStatus: OrderViewStatus = data.payStatus === 'pending' && data.canPay
        ? 'pending'
        : data.payStatus === 'paid' && data.fulfillmentStatus === 'opening'
          ? 'opening'
          : data.payStatus === 'paid' && (data.fulfillmentStatus === 'fulfilled' || data.membership?.status === 'active')
            ? 'completed'
            : 'abandoned';
  const isPaid = orderViewStatus === 'completed';
  const isOpening = orderViewStatus === 'opening';
  const isPendingPayable = orderViewStatus === 'pending';
  const isAbandoned = orderViewStatus === 'abandoned';
  const remainDays = data.membership?.remainDays ?? (isPaid ? 30 : 0);
  const expiryLabel = formatDateTime(data.membership?.endAt);
  const statusText = isPaid ? '已完成' : isOpening ? '开通中' : isPendingPayable ? '待支付' : '已废弃请重新下单';
  const heroTitle = isPaid ? '订单已完成' : isOpening ? '服务开通中' : isPendingPayable ? '订单待支付' : '订单已废弃';
  const heroDesc = isPaid ? '会员服务已完成开通' : isOpening ? '已支付成功，人工正在处理会员开通' : isPendingPayable ? '请在 30 分钟内完成支付，超时需重新下单' : '该订单已超过支付有效期，请重新选择套餐下单';
  const heroIconSrc = isPendingPayable || isOpening ? ORDER_CLOCK_ICON : isAbandoned ? ORDER_ABANDONED_ICON : '';
  const heroIconClass = isPaid ? 'pay-success__icon--success' : isPendingPayable || isOpening ? 'pay-success__icon--pending' : 'pay-success__icon--abandoned';
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
              <Text className='info-row__label'>{isPendingPayable ? '下单时间' : isOpening ? '支付时间' : '开通时间'}</Text>
              <Text className='info-row__value'>{isPaid ? formatDateTime(data.membership?.startAt) : formatDateTime(data.paidAt ?? data.createdAt)}</Text>
            </View>
            <View className='info-row'>
              <Text className='info-row__label'>{isPendingPayable ? '支付有效期' : isAbandoned ? '废弃时间' : isOpening ? '服务状态' : '到期时间'}</Text>
              <Text className='info-row__value'>{isPendingPayable || isAbandoned ? formatDateTime(data.pendingExpireAt) : isOpening ? '人工开通中' : expiryLabel}</Text>
            </View>
            <View className='info-row'>
              <Text className='info-row__label'>支付金额</Text>
              <Text className='info-row__value'>¥{(data.amount ?? 0).toFixed(2)}</Text>
            </View>
            {data.pointsDeducted ? (
              <View className='info-row'>
                <Text className='info-row__label'>积分抵扣</Text>
                <Text className='info-row__value'>-{data.pointsDeducted} 积分</Text>
              </View>
            ) : null}
            <View className='info-row'>
              <Text className='info-row__label'>支付状态</Text>
              <Text className='info-row__value'>{data.payStatus === 'paid' ? '已支付' : data.payStatus === 'pending' ? '待支付' : '已关闭'}</Text>
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
