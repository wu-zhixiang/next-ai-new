import { useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import AuthModal from '@/components/AuthModal';
import { callCloudFunction } from '@/services/api';
import { clearStoredInviteCode, resolveInviteCode } from '@/utils/invite';

const CACHE_KEY = 'gpt_pay_user_info';

interface CachedUserInfo {
  userId: string;
  openid?: string;
  openId?: string;
  inviterUserId?: string;
  nickname?: string;
  avatarUrl?: string;
  inviteCode?: string;
  pointsBalance?: number;
  aiAccountRegistered?: boolean;
}

interface LoginResult extends CachedUserInfo {
  mobileBound?: boolean;
}

const NEWS_LIST = [
  {
    id: 1,
    tag: 'GPT-5',
    title: 'OpenAI 发布 GPT-5：多模态推理能力大幅提升',
    desc: '最新发布的 GPT-5 在代码生成、数学推理和多模态理解方面实现了质的飞跃，标志着通用人工智能的重要进展。',
    source: 'OpenAI',
    time: '2小时前',
    views: '12.5k',
    thumbType: 'cube',
  },
  {
    id: 2,
    tag: 'Claude',
    title: 'Anthropic Claude 新增 Agent SDK，简化 AI Agent 开发',
    desc: 'Claude Agent SDK 提供了完整的工具链，开发者可以快速构建具备自主决策能力的 AI Agent 应用。',
    source: 'Anthropic',
    time: '5小时前',
    views: '8.3k',
    thumbType: 'desk',
  },
  {
    id: 3,
    tag: '行业',
    title: '2025 AI 行业趋势：RAG 成为企业落地首选方案',
    desc: '检索增强生成（RAG）技术正在成为企业 AI 落地的核心范式，结合向量数据库与大模型的混合架构广受关注。',
    source: 'AI Weekly',
    time: '1天前',
    views: '6.7k',
    thumbType: 'cube',
  },
];

export default function NewsPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeInviteCode, setActiveInviteCode] = useState('');
  const router = useRouter();

  useDidShow((options) => {
    const inviteCode = resolveInviteCode(router.params, options);
    setActiveInviteCode(inviteCode);
    checkAuth(inviteCode);
  });

  function checkAuth(inviteCode: string) {
    const raw = Taro.getStorageSync(CACHE_KEY) as string;
    if (raw) {
      try {
        const cached: CachedUserInfo = JSON.parse(raw);
        if (cached.userId) {
          if (inviteCode || !cached.openId && !cached.openid) {
            void syncLoginState(cached, inviteCode);
          }
          return;
        }
      } catch { /* ignore */ }
    }

    setShowAuthModal(true);
  }

  async function syncLoginState(cached: CachedUserInfo, inviteCode: string): Promise<void> {
    try {
      const loginResult = await callCloudFunction<LoginResult>('user-login', {
        nickname: cached.nickname,
        avatarUrl: cached.avatarUrl,
        inviteCode,
        source: inviteCode ? 'share' : 'direct',
      });
      const nextInfo: CachedUserInfo = {
        ...cached,
        ...loginResult,
        openid: loginResult.openid ?? loginResult.openId,
        openId: loginResult.openId ?? loginResult.openid,
      };
      saveToCache(nextInfo);
      if (inviteCode && loginResult.inviterUserId) {
        clearStoredInviteCode();
      }
    } catch {
      // 保留旧缓存，不打断用户浏览；下次授权或进入会员页会再次刷新。
    }
  }

  function saveToCache(info: CachedUserInfo) {
    Taro.setStorageSync(CACHE_KEY, JSON.stringify(info));
  }

  function handleAuthSuccess(info: CachedUserInfo) {
    saveToCache(info);
    if (activeInviteCode && info.inviterUserId) {
      clearStoredInviteCode();
    }
    setShowAuthModal(false);
  }

  return (
    <View className='page'>
      <AppTransparentHeader title='AI资讯' showBack={false} />

      <View className='news-page'>
        <View className='saas-shell news-shell'>
          <View className='news-hero'>
            <View className='news-hero__art'>
              <View className='news-hero__orb news-hero__orb--one' />
              <View className='news-hero__orb news-hero__orb--two' />
            </View>
            <View className='news-hero__content'>
              <View className='saas-chip'>✦ 今日精选</View>
              <Text className='news-hero__title'>全球 AI 资讯，一站掌握</Text>
              <Text className='news-hero__desc'>追踪 OpenAI、Anthropic、Google 等前沿动态</Text>
            </View>
            <View className='news-hero__dots'>
              <View className='news-hero__dot news-hero__dot--active' />
              <View className='news-hero__dot' />
              <View className='news-hero__dot' />
            </View>
          </View>

          <View className='news-feed'>
            {NEWS_LIST.map((item) => (
              <View className='news-card' key={item.id}>
                <View className='news-card__body'>
                  <View className='news-card__meta'>
                    <Text className='saas-chip news-card__tag'>{item.tag}</Text>
                    <Text className='news-card__time'>{item.time}</Text>
                  </View>
                  <Text className='news-card__title'>{item.title}</Text>
                  <Text className='news-card__desc'>{item.desc}</Text>
                  <View className='news-card__foot'>
                    <Text className='news-card__source'>{item.source}</Text>
                    <Text className='news-card__views'>{item.views} 阅读</Text>
                  </View>
                </View>
                <View className={`news-card__thumb news-card__thumb--${item.thumbType}`}>
                  <View className='news-card__shape' />
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      <AuthModal
        visible={showAuthModal}
        inviteCode={activeInviteCode}
        onAuthSuccess={handleAuthSuccess}
      />
    </View>
  );
}
