import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { callCloudFunction } from '@/services/api';
import type { MembershipView } from '@/types';
import { formatDate } from '@/utils/format';

interface HomeData {
  membership: MembershipView;
}

export default function IndexPage(): JSX.Element {
  const [membership, setMembership] = useState<MembershipView>({ status: 'none' });

  useDidShow(() => {
    void loadData();
  });

  async function loadData(): Promise<void> {
    try {
      const data = await callCloudFunction<HomeData>('get-member-home');
      setMembership(data.membership);
    } catch {
      setMembership({ status: 'none' });
    }
  }

  const isActive = membership.status === 'active';
  const remainDays = membership.remainDays ?? 0;
  const statusLabel = membership.status === 'none' ? '未开通' : isActive ? '已激活' : '待续费';
  const planLabel = membership.planName ?? 'Open AI资讯会员';
  const expiryLabel = membership.status === 'none' ? '购买后自动开始计时' : `到期日 ${formatDate(membership.endAt)}`;

  return (
    <View className='page home-page'>
      <AppTransparentHeader title='Open AI资讯会员' showBack={false} />
      <View className='home-grid' />
      <View className='home-orb home-orb--cyan' />
      <View className='home-orb home-orb--blue' />

      <View className='home-shell'>

        <View className='glass-panel home-hero'>
          <View className='home-hero__copy'>
            <Text className='home-hero__title'>开通会员，享受openai plus 会员</Text>
          </View>
          <View className='home-hero__actions'>
            <Button className='primary-button home-primary-button' onClick={() => Taro.switchTab({ url: '/pages/member/index' })}>
              查看会员中心
            </Button>
          </View>
        </View>

        <View className='glass-panel home-membership'>
          <View className='home-membership__head'>
            <View>
              <Text className='home-section-label'>当前套餐</Text>
              <Text className='home-membership__title'>{planLabel}</Text>
            </View>
            <Text className='home-membership__expiry'>{expiryLabel}</Text>
          </View>

          <View className='home-membership__metric'>
            <Text className='home-membership__value'>{remainDays}</Text>
            <Text className='home-membership__unit'>剩余天数</Text>
          </View>

          <View className='home-membership__meta'>
            <View className='home-stat-card'>
              <Text className='home-stat-card__label'>状态</Text>
              <Text className='home-stat-card__value'>{isActive ? '服务正常' : '等待购买或续费'}</Text>
            </View>
            <View className='home-stat-card'>
              <Text className='home-stat-card__label'>提醒策略</Text>
              <Text className='home-stat-card__value'>3 / 7 / 30 天自动触达</Text>
            </View>
          </View>
        </View>

        <View className='home-stats'>
          <View className='glass-panel home-mini-panel'>
            <Text className='home-section-label'>状态可见</Text>
            <Text className='home-mini-panel__value'>开通即展示</Text>
            <Text className='home-mini-panel__note'>付款完成后直接显示剩余天数、到期时间和交付状态。</Text>
          </View>
          <View className='glass-panel home-mini-panel'>
            <Text className='home-section-label'>自动提醒</Text>
            <Text className='home-mini-panel__value'>批量提醒</Text>
            <Text className='home-mini-panel__note'>后台筛选临期会员并统一发送续费提醒。</Text>
          </View>
        </View>

      </View>
    </View>
  );
}
