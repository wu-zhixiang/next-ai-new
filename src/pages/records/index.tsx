import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { SaasPageFrame } from '@/components/SaasPageFrame';

const SERVICES = [
  {
    tier: '高级版',
    title: 'AI 助手订阅服务',
    orderNo: 'SUB-20231001-88',
    start: '2023-10-01 14:30:00',
    end: '2024-10-01 14:30:00',
  },
  {
    tier: '专业版',
    title: '云端存储空间 (1TB)',
    orderNo: 'STO-20230915-42',
    start: '2023-09-15 09:15:00',
    end: '2024-09-15 09:15:00',
  },
];

export default function RecordsPage(): JSX.Element {
  return (
    <SaasPageFrame title='服务记录' showBack={false}>
      <View className='records-page'>
      {/* <View className='records-tabs'>
        <Text className='records-tabs__item'>全部</Text>
        <Text className='records-tabs__item records-tabs__item--active'>进行中</Text>
        <Text className='records-tabs__item'>已完成</Text>
        <Text className='records-tabs__item'>已失效</Text>
      </View> */}

      <View className='saas-shell records-shell'>
        {SERVICES.map((item) => (
          <View key={item.orderNo} className='record-card'>
            <View className='record-card__head'>
              <View>
                <Text className='record-card__tier'>{item.tier}</Text>
                <Text className='record-card__title'>{item.title}</Text>
              </View>
              <View className='status-pill'>
                <Text className='status-pill__dot' />
                <Text>进行中</Text>
              </View>
            </View>
            <View className='record-card__rows'>
              <View className='info-row'>
                <Text className='info-row__label'>服务单号</Text>
                <Text className='info-row__value'>{item.orderNo}</Text>
              </View>
              <View className='info-row'>
                <Text className='info-row__label'>开通时间</Text>
                <Text className='info-row__value'>{item.start}</Text>
              </View>
              <View className='info-row'>
                <Text className='info-row__label'>到期时间</Text>
                <Text className='info-row__value'>{item.end}</Text>
              </View>
            </View>
            <View className='record-card__action' onClick={() => Taro.navigateTo({ url: '/pages/pay-result/index' })}>
              <Text>查看服务详情</Text>
              <Text>›</Text>
            </View>
          </View>
        ))}
      </View>

      </View>
    </SaasPageFrame>
  );
}
