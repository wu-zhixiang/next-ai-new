import { useEffect, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { usePullDownRefresh } from '@tarojs/taro';
import { SaasPageFrame, type PageTheme } from '@/components/SaasPageFrame';
import { callCloudFunction } from '@/services/api';
import { formatDate } from '@/utils/format';
import type { MembershipView } from '@/types';

interface MemberHomeData {
  activeServices?: MembershipView[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

const PAGE_THEME: PageTheme = {
  headerColor: '#927239',
  headerFadeColor: '#F7F1E4',
  pageBackground: '#F7F5F0',
  accentColor: '#A78542',
  accentDeepColor: '#59451F',
  accentSoftColor: '#E7D5A5',
};

function formatRemainDays(endAt?: number): string {
  if (!endAt) {
    return '0 天';
  }
  const days = Math.max(0, Math.ceil((endAt - Date.now()) / DAY_MS));
  return `${days} 天`;
}

export default function ActiveServicesPage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [services, setServices] = useState<MembershipView[]>([]);

  useEffect(() => {
    void loadServices();
  }, []);

  usePullDownRefresh(() => {
    void loadServices(false).finally(() => Taro.stopPullDownRefresh());
  });

  async function loadServices(showLoading = true): Promise<void> {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const result = await callCloudFunction<MemberHomeData>('get-member-home');
      const nextServices = (result.activeServices ?? [])
        .filter((item) => item.status === 'active' && (item.endAt ?? 0) > Date.now())
        .sort((left, right) => (right.endAt ?? 0) - (left.endAt ?? 0));
      setServices(nextServices);
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '服务加载失败',
        icon: 'none',
      });
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  function renderService(service: MembershipView): JSX.Element {
    return (
      <View key={`${service.productCode ?? ''}-${service.planCode ?? ''}-${service.endAt ?? ''}`} className='active-service-card'>
        <View className='active-service-card__head'>
          <View>
            <Text className='active-service-card__product'>{service.productName ?? '会员服务'}</Text>
            <Text className='active-service-card__plan'>{service.planName ?? '已购服务'}</Text>
          </View>
          <View className='active-service-card__status'>
            <Text>生效中</Text>
          </View>
        </View>
        <View className='active-service-card__meta'>
          <View className='active-service-card__meta-item'>
            <Text className='active-service-card__label'>剩余时间</Text>
            <Text className='active-service-card__value'>{formatRemainDays(service.endAt)}</Text>
          </View>
          <View className='active-service-card__meta-item'>
            <Text className='active-service-card__label'>到期时间</Text>
            <Text className='active-service-card__value'>{formatDate(service.endAt)}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <SaasPageFrame title='生效服务' theme={PAGE_THEME}>
      <View className='active-services-page'>
        <View className='saas-shell active-services-shell'>
          {loading ? (
            <View className='active-services-empty'>加载中...</View>
          ) : services.length > 0 ? (
            <View className='active-services-list'>
              {services.map(renderService)}
            </View>
          ) : (
            <View className='active-services-empty'>
              <Text className='active-services-empty__title'>暂无生效服务</Text>
              <Text className='active-services-empty__desc'>已购买且仍在有效期内的商品会展示在这里</Text>
            </View>
          )}
        </View>
      </View>
    </SaasPageFrame>
  );
}
