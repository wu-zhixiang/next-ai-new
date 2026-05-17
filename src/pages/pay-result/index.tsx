import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { SaasPageFrame } from '@/components/SaasPageFrame';
import { callCloudFunction } from '@/services/api';
import { formatDate } from '@/utils/format';

interface PayResultData {
  orderNo: string;
  payStatus: 'pending' | 'paid' | 'failed' | 'closed';
  membership?: {
    status: 'active' | 'expired';
    startAt: number;
    endAt: number;
    remainDays: number;
  };
}

export default function PayResultPage(): JSX.Element {
  const [data, setData] = useState<PayResultData>({
    orderNo: '',
    payStatus: 'pending',
  });

  const showMockButton = process.env.NODE_ENV !== 'production';

  useLoad((options) => {
    const orderNo = options.orderNo ?? '';
    if (orderNo) {
      void loadResult(orderNo);
    }
  });

  async function loadResult(orderNo: string): Promise<void> {
    const result = await callCloudFunction<PayResultData>('get-pay-result', { orderNo });
    setData(result);
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

  const isPaid = data.payStatus === 'paid';
  const remainDays = data.membership?.remainDays ?? (isPaid ? 30 : 0);
  const expiryLabel = formatDate(data.membership?.endAt);
  const statusText = isPaid ? '正常' : data.payStatus === 'failed' ? '失败' : '处理中';
  const orderNo = data.orderNo || 'AI-REG-88291032';

  return (
    <SaasPageFrame title='服务详情'>
      <View className='pay-detail-page'>
      <View className='pay-ambient pay-ambient--one' />
      <View className='pay-ambient pay-ambient--two' />

      <View className='saas-shell pay-detail-shell'>
        <View className='saas-shell__inner'>
        <View className='pay-success'>
          <View className='pay-success__icon'>
            <Text>✓</Text>
            <View className='pay-success__ring' />
          </View>
          <Text className='pay-success__title'>{isPaid ? '服务已生效' : '订单处理中'}</Text>
          <Text className='pay-success__desc'>{isPaid ? '高级 AI 能力已成功开启' : '支付回调可能存在短暂延迟'}</Text>
        </View>

        <View className='pay-membership-card'>
          <View className='pay-membership-card__veil' />
          <View className='pay-membership-card__content'>
            <View className='pay-membership-card__head'>
              <View>
                <Text className='pay-membership-card__label'>当前方案</Text>
                <Text className='pay-membership-card__title'>高级版会员</Text>
              </View>
              <Text className='pay-membership-card__badge'>{isPaid ? '已生效' : '待确认'}</Text>
            </View>
            <View className='pay-membership-card__days'>
              <Text className='pay-membership-card__value'>{remainDays}</Text>
              <Text className='pay-membership-card__unit'>剩余天数</Text>
            </View>
            <View className='pay-membership-card__progress'>
              <View className='pay-membership-card__bar' />
            </View>
            <Text className='pay-membership-card__expiry'>到期时间 {expiryLabel === '-' ? '2026.08.18' : expiryLabel}</Text>
          </View>
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
              <Text className='info-row__value'>{formatDate(data.membership?.startAt)}</Text>
            </View>
            <View className='info-row'>
              <Text className='info-row__label'>到期时间</Text>
              <Text className='info-row__value'>{expiryLabel}</Text>
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

        {showMockButton ? (
          <Button className='pay-secondary-button' onClick={() => void handleMockPaid()}>
            模拟支付成功
          </Button>
        ) : null}
        </View>
      </View>

      <View className='pay-bottom-cta'>
        <Button className='saas-button pay-bottom-cta__button' onClick={() => Taro.switchTab({ url: '/pages/member/index' })}>
          返回会员中心
        </Button>
      </View>
      </View>
    </SaasPageFrame>
  );
}
