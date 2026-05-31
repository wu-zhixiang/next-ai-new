import { useEffect, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useShareAppMessage } from '@tarojs/taro';
import { SaasPageFrame } from '@/components/SaasPageFrame';
import { SkeletonInvitePage } from '@/components/Skeleton';
import { callCloudFunction } from '@/services/api';
import { formatDateTime } from '@/utils/format';
import { showTabBarSafely } from '@/utils/tabbar';

const CACHE_KEY = 'gpt_pay_user_info';

interface CachedUserInfo {
  userId: string;
  nickname?: string;
  avatarUrl?: string;
  inviteCode?: string;
}

interface LoginResult extends CachedUserInfo {
  openid?: string;
  openId?: string;
  pointsBalance?: number;
  aiAccountRegistered?: boolean;
}

interface InviteeView {
  userId: string;
  nickname: string;
  avatarUrl?: string;
  joinedAt: number;
  status: '已加入';
  rewardPoints: number;
}

interface InviteHomeResult {
  inviteCode?: string;
  inviteCount: number;
  pointsBalance: number;
  totalRewardPoints: number;
  invitees: InviteeView[];
}

function formatNumber(value: number): string {
  return value.toLocaleString('zh-CN');
}

function getInitial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || 'AI';
}

const FREE_SUBSCRIPTION_INVITE_TARGET = 10;

export default function InvitePage(): JSX.Element {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<InviteHomeResult>({
    inviteCount: 0,
    pointsBalance: 0,
    totalRewardPoints: 0,
    invitees: [],
  });

  useEffect(() => {
    Taro.showShareMenu({
      withShareTicket: true,
    });
    void loadInviteHome();
  }, []);

  useDidShow(() => {
    showTabBarSafely();
  });

  useShareAppMessage(() => {
    const inviteCode = data.inviteCode || getCachedUser()?.inviteCode || '';
    return {
      title: '全球 AI 资讯，一站掌握',
      path: `/pages/news/index${inviteCode ? `?inviteCode=${encodeURIComponent(inviteCode)}` : ''}`,
    };
  });

  function getCachedUser(): CachedUserInfo | null {
    const raw = Taro.getStorageSync(CACHE_KEY) as string;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedUserInfo;
    } catch {
      return null;
    }
  }

  async function ensureLogin(): Promise<void> {
    const cached = getCachedUser();
    if (cached?.userId && cached.inviteCode) {
      return;
    }

    const loginResult = await callCloudFunction<LoginResult>('user-login', {
      nickname: cached?.nickname,
      avatarUrl: cached?.avatarUrl,
      source: 'invite_page',
    });
    Taro.setStorageSync(CACHE_KEY, JSON.stringify({
      ...cached,
      ...loginResult,
      openid: loginResult.openid ?? loginResult.openId,
      openId: loginResult.openId ?? loginResult.openid,
    }));
  }

  async function loadInviteHome(): Promise<void> {
    setLoading(true);
    try {
      await ensureLogin();
      const result = await callCloudFunction<InviteHomeResult>('get-invite-home');
        setData(result);
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '邀请信息加载失败',
        icon: 'none',
      });
    } finally {
      setLoading(false);
    }
  }

  const inviteProgress = Math.min(data.inviteCount, FREE_SUBSCRIPTION_INVITE_TARGET);
  const inviteProgressPercent = Math.min(100, Math.round((inviteProgress / FREE_SUBSCRIPTION_INVITE_TARGET) * 100));

  return (
    <SaasPageFrame title='邀请有礼' showBack={false}>
      <View className='invite-page'>
        <View className='saas-shell invite-shell'>
          {loading ? (
            <SkeletonInvitePage />
          ) : (
            <>
              <View className='invite-hero'>
                <View className='invite-hero__glow invite-hero__glow--right' />
                <View className='invite-hero__glow invite-hero__glow--left' />
                <View className='invite-stats'>
                  <View className='invite-stat'>
                    <Text className='invite-stat__label'>累计邀请</Text>
                    <View className='invite-stat__line'>
                      <Text className='invite-stat__value'>{formatNumber(data.inviteCount)}</Text>
                      <Text className='invite-stat__unit'>人</Text>
                    </View>
                  </View>
                  <View className='invite-stat'>
                    <Text className='invite-stat__label'>当前积分</Text>
                    <View className='invite-stat__line'>
                      <Text className='invite-stat__value'>{formatNumber(data.pointsBalance)}</Text>
                    </View>
                  </View>
                </View>
                <View className='invite-progress'>
                  <View className='invite-progress__labels'>
                    <Text>0</Text>
                    <Text>{FREE_SUBSCRIPTION_INVITE_TARGET}</Text>
                  </View>
                  <View className='invite-progress__track'>
                    <View className='invite-progress__bar' style={{ width: `${inviteProgressPercent}%` }} />
                  </View>
                  <Text className='invite-progress__hint'>累计邀请10人，进入免费订阅期</Text>
                </View>
                <Button className='saas-button invite-hero__button' openType='share'>立即邀请好友</Button>
              </View>

              <View className='section-head'>
                <Text className='section-head__title'>邀请记录</Text>
                <Text className='section-head__more'>累计返还 {formatNumber(data.totalRewardPoints)} 积分</Text>
              </View>

              <View className='invite-list'>
                {data.invitees.length > 0 ? (
                  data.invitees.map((item) => (
                    <View key={item.userId} className='invite-record'>
                      <View className='invite-record__avatar'>
                        {item.avatarUrl ? (
                          <Image className='invite-record__avatar-image' src={item.avatarUrl} mode='aspectFill' />
                        ) : (
                          <Text>{getInitial(item.nickname)}</Text>
                        )}
                      </View>
                      <View className='invite-record__body'>
                        <View className='invite-record__top'>
                          <Text className='invite-record__name'>{item.nickname}</Text>
                          <Text className='invite-record__status'>{item.status}</Text>
                        </View>
                        <View className='invite-record__bottom'>
                          <Text className='invite-record__time'>{formatDateTime(item.joinedAt)}</Text>
                          <Text className='invite-record__points'>+{formatNumber(item.rewardPoints)} 积分</Text>
                        </View>
                      </View>
                    </View>
                  ))
                ) : (
                  <View className='invite-empty'>
                    <Text className='invite-empty__title'>还没有邀请记录</Text>
                    <Text className='invite-empty__desc'>点击立即邀请好友，好友授权登录后会自动成为你的下级用户。</Text>
                  </View>
                )}
              </View>

              <View className='invite-info'>
                <Text className='invite-info__icon'>i</Text>
                <Text className='invite-info__text'>好友通过你的链接授权登录后会自动绑定邀请关系；被邀请人后续订阅会员时，将按实付金额的 10% 折算积分返还给你，积分后续可用于支付抵扣。</Text>
              </View>
            </>
          )}
        </View>
      </View>
    </SaasPageFrame>
  );
}
