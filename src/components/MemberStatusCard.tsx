import { Text, View } from '@tarojs/components';
import type { MembershipView } from '@/types';
import { formatDate } from '@/utils/format';

interface Props {
  membership: MembershipView;
}

export function MemberStatusCard({ membership }: Props): JSX.Element {
  const isActive = membership.status === 'active';
  const isOpening = membership.status === 'opening';

  if (membership.status === 'none') {
    return (
      <View className='card hero-card'>
        <Text className='hero-eyebrow'>会员状态</Text>
        <Text className='hero-title'>尚未开通会员</Text>
        <Text className='page-subtitle'>购买后会在这里展示剩余天数、到期时间和交付状态。</Text>
      </View>
    );
  }

  return (
    <View className='card hero-card'>
      <Text className='hero-eyebrow'>会员状态</Text>
      <Text className='hero-title'>{membership.planName ?? '会员服务'}</Text>
      <View className='hero-metric'>
        <Text className='hero-value'>{membership.remainDays ?? 0}</Text>
        <Text className='hero-unit'>天可用</Text>
      </View>
      <View className='hero-meta'>
        <Text>{isActive ? '状态正常' : isOpening ? '人工开通中' : '已到期'}</Text>
        <Text>{isOpening ? '支付成功后开始处理' : `到期 ${formatDate(membership.endAt)}`}</Text>
      </View>
      <View className='chip-row'>
        <Text className={`chip ${isActive ? 'chip-success' : isOpening ? 'chip-warning' : 'chip-danger'}`}>{isActive ? '会员有效' : isOpening ? '开通中' : '需要续费'}</Text>
      </View>
    </View>
  );
}
