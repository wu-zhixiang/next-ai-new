import { Button, Text, View } from '@tarojs/components';
import { SaasPageFrame } from '@/components/SaasPageFrame';

const RECORDS = [
  { name: '李美丽', status: '体验中', time: '2023-11-18 09:15', points: '+50 积分', initial: 'L' },
  { name: '王小明', status: '已加入', time: '2023-11-15 18:45', points: '+100 积分', initial: 'W' },
];

export default function InvitePage(): JSX.Element {
  return (
    <SaasPageFrame title='邀请有礼' showBack={false}>
      <View className='invite-page'>
      <View className='saas-shell invite-shell'>
        
        <View className='invite-hero'>
          <View className='invite-hero__glow invite-hero__glow--right' />
          <View className='invite-hero__glow invite-hero__glow--left' />
          <View className='invite-stats'>
            <View className='invite-stat glass-card'>
              <Text className='invite-stat__label'>累计邀请</Text>
              <View className='invite-stat__line'>
                <Text className='invite-stat__value'>12</Text>
                <Text className='invite-stat__unit'>人</Text>
              </View>
            </View>
            <View className='invite-stat glass-card'>
              <Text className='invite-stat__label'>当前积分</Text>
              <View className='invite-stat__line'>
                <Text className='invite-stat__value'>2,450</Text>
              </View>
            </View>
          </View>
          <Button className='saas-button invite-hero__button'>立即邀请好友</Button>
        </View>
        <View className='section-head'>
          <Text className='section-head__title'>邀请记录</Text>
          <Text className='section-head__more'>查看更多</Text>
        </View>

        <View className='invite-list'>
          {RECORDS.map((item) => (
            <View key={item.name} className='invite-record'>
              <View className='invite-record__avatar'>
                <Text>{item.initial}</Text>
              </View>
              <View className='invite-record__body'>
                <View className='invite-record__top'>
                  <Text className='invite-record__name'>{item.name}</Text>
                  <Text className='invite-record__status'>{item.status}</Text>
                </View>
                <View className='invite-record__bottom'>
                  <Text className='invite-record__time'>{item.time}</Text>
                  <Text className='invite-record__points'>{item.points}</Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View className='invite-info'>
          <Text className='invite-info__icon'>i</Text>
          <Text className='invite-info__text'>邀请好友不仅可以获得高级体验积分，还可解锁更多专属 AI 专栏权限。积分可用于兑换会员权益及 AI 创意工具包。</Text>
        </View>
        </View>

      </View>
    </SaasPageFrame>
  );
}
