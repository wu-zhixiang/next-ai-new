import { useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { callCloudFunction } from '@/services/api';
import { formatMobileDisplay } from '@/utils/mobile';
import { enableReminderSubscription } from '@/utils/subscription';

interface ProfileData {
  mobile?: string;
  mobileBound?: boolean;
  nickname?: string;
  membershipStatus: 'active' | 'expired' | 'none';
  subscribeMsgAuth: boolean;
}

export default function ProfilePage(): JSX.Element {
  const [profile, setProfile] = useState<ProfileData>({
    membershipStatus: 'none',
    subscribeMsgAuth: false,
  });

  useDidShow(() => {
    void loadProfile();
  });

  async function loadProfile(): Promise<void> {
    const data = await callCloudFunction<ProfileData>('get-profile');
    setProfile(data);
  }

  return (
    <View className='page'>
      <AppTransparentHeader title='个人中心' />
      <View className='page-body page-body--nav'>
        <View className='card hero-card'>
          <Text className='hero-eyebrow'>账号信息</Text>
          <Text className='hero-title'>{profile.nickname ?? '未设置昵称'}</Text>
          <View className='hero-meta'>
            <Text>{formatMobileDisplay(profile.mobile)}</Text>
            <Text>{profile.membershipStatus === 'active' ? '会员中' : '未激活'}</Text>
          </View>
        </View>
        <View className='card'>
          <Text className='section-eyebrow'>状态信息</Text>
          <Text className='section-title'>当前状态</Text>
          <View className='detail-list'>
            <View className='detail-row'>
              <Text className='detail-label'>会员状态</Text>
              <Text className='detail-value'>
                {profile.membershipStatus === 'active' ? '已开通' : profile.membershipStatus === 'expired' ? '已过期' : '未开通'}
              </Text>
            </View>
            <View className='detail-row'>
              <Text className='detail-label'>提醒授权</Text>
              <Text className='detail-value'>{profile.subscribeMsgAuth ? '已授权' : '未授权'}</Text>
            </View>
          </View>
          <Button className='primary-button' onClick={() => Taro.switchTab({ url: '/pages/member/index' })}>
            查看会员页
          </Button>
          <Button className='secondary-button' onClick={() => Taro.switchTab({ url: '/pages/member/index' })}>
            去开通会员
          </Button>
          <Button
            className='secondary-button'
            onClick={() => {
              void enableReminderSubscription().then((changed) => {
                if (changed) {
                  void loadProfile();
                }
              });
            }}
          >
            {profile.subscribeMsgAuth ? '提醒已开启' : '开启到期提醒'}
          </Button>
        </View>
      </View>
    </View>
  );
}
