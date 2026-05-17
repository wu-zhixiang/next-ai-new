import { Text, View } from '@tarojs/components';
import type { PlanView } from '@/types';
import { formatPrice } from '@/utils/format';

interface Props {
  plan: PlanView;
  selected: boolean;
  onSelect: (planCode: string) => void;
}

export function PlanCard({ plan, selected, onSelect }: Props): JSX.Element {
  return (
    <View
      className={`card card-accent ${selected ? 'selected-card' : ''}`}
      onClick={() => onSelect(plan.planCode)}
    >
      <Text className='section-eyebrow'>{selected ? '已选套餐' : '会员套餐'}</Text>
      <Text className='section-title'>{plan.planName}</Text>
      <View className='price-row'>
        <Text className='price-currency'>¥</Text>
        <Text className='price-value'>{plan.price.toFixed(0)}</Text>
        <Text className='price-note'>/ {plan.durationDays} 天</Text>
      </View>
      <View className='chip-row'>
        <Text className='chip chip-neutral'>{plan.durationDays} 天有效期</Text>
        <Text className='chip chip-neutral'>{selected ? '即将购买' : '可立即开通'}</Text>
      </View>
      <View style={{ marginTop: '18px' }}>
        <Text className='muted'>{plan.description ?? '标准会员套餐'}</Text>
      </View>
    </View>
  );
}
