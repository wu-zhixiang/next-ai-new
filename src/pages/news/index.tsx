import { useEffect, useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import AuthModal, { type AuthUserInfo } from '@/components/AuthModal';
import { callCloudFunction } from '@/services/api';
import type { AiNewsView } from '@/types';
import { clearStoredInviteCode, resolveInviteCode } from '@/utils/invite';
import { showTabBarSafely } from '@/utils/tabbar';

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
  profileAuthed?: boolean;
}

interface LoginResult extends CachedUserInfo {
  mobileBound?: boolean;
}

interface NewsListResult {
  items: AiNewsView[];
}

type NewsFilterKey = 'hot' | 'latest' | 'aiGiants' | 'tools';

interface NewsFilterOption {
  key: NewsFilterKey;
  label: string;
  sort?: 'hot' | 'latest';
  tag?: string;
}

const NEWS_FILTERS: NewsFilterOption[] = [
  { key: 'hot', label: '热度', sort: 'hot' },
  { key: 'latest', label: '最新', sort: 'latest' },
  { key: 'aiGiants', label: 'AI巨头', sort: 'latest', tag: 'AI巨头' },
  { key: 'tools', label: '工具', sort: 'latest', tag: '工具' },
];

function getNewsFilterLabel(filterKey: NewsFilterKey): string {
  return NEWS_FILTERS.find((item) => item.key === filterKey)?.label ?? NEWS_FILTERS[0].label;
}

function formatRelativeTime(value: number): string {
  if (!value) return '刚刚';
  const diff = Math.max(0, Date.now() - value);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  return `${Math.floor(diff / day)}天前`;
}

function formatHeat(value: number): string {
  if (value >= 10000) return `${(value / 10000).toFixed(1)}w`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value || 0);
}

export default function NewsPage() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeInviteCode, setActiveInviteCode] = useState('');
  const [newsList, setNewsList] = useState<AiNewsView[]>([]);
  const [newsLoading, setNewsLoading] = useState(true);
  const [activeFilterKey, setActiveFilterKey] = useState<NewsFilterKey>('hot');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sharePanelVisible, setSharePanelVisible] = useState(false);
  const [shareItem, setShareItem] = useState<AiNewsView | null>(null);
  const router = useRouter();

  useEffect(() => {
    enableShareMenu();
    const inviteCode = resolveInviteCode(router.params);
    setActiveInviteCode(inviteCode);
    checkAuth(inviteCode);
    void loadNews('hot');
  }, []);

  useDidShow(() => {
    showTabBarSafely();
  });

  useShareAppMessage(() => getShareAppMessage(shareItem));

  useShareTimeline(() => getShareTimeline(shareItem));

  function enableShareMenu(): void {
    try {
      Taro.showShareMenu({
        withShareTicket: true,
        menus: ['shareAppMessage', 'shareTimeline'],
      } as unknown as Parameters<typeof Taro.showShareMenu>[0]);
    } catch {
      // 部分基础库不支持 shareTimeline 菜单参数，忽略即可。
    }
  }

  function getShareAppMessage(item: AiNewsView | null) {
    if (!item) {
      return {
        title: 'AIO AI资讯',
        path: '/pages/news/index',
      };
    }
    return {
      title: item.title,
      path: `/pages/news-detail/index?id=${encodeURIComponent(item.id)}`,
    };
  }

  function getShareTimeline(item: AiNewsView | null) {
    if (!item) {
      return {
        title: 'AIO AI资讯',
        query: '',
      };
    }
    return {
      title: item.title,
      query: `id=${encodeURIComponent(item.id)}`,
    };
  }

  async function loadNews(filterKey = activeFilterKey): Promise<void> {
    setNewsLoading(true);
    try {
      const filter = NEWS_FILTERS.find((item) => item.key === filterKey) ?? NEWS_FILTERS[0];
      const result = await callCloudFunction<NewsListResult>('list-ai-news', {
        limit: 20,
        sort: filter.sort ?? 'hot',
        tag: filter.tag,
      });
      setNewsList(result.items);
    } catch {
      setNewsList([]);
    } finally {
      setNewsLoading(false);
    }
  }

  function checkAuth(inviteCode: string) {
    const raw = Taro.getStorageSync(CACHE_KEY) as string;
    if (raw) {
      try {
        const cached: CachedUserInfo = JSON.parse(raw);
        if (cached.userId) {
          if (inviteCode || !cached.openId && !cached.openid) {
            void syncLoginState(cached, inviteCode);
          }
          if (!hasUserProfile(cached)) {
            setShowAuthModal(true);
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
        profileAuthed: Boolean(loginResult.nickname || loginResult.avatarUrl),
      };
      saveToCache(nextInfo);
      if (!hasUserProfile(nextInfo)) {
        setShowAuthModal(true);
      }
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

  function hasUserProfile(info: Pick<CachedUserInfo, 'nickname' | 'avatarUrl' | 'profileAuthed'>): boolean {
    return Boolean(info.profileAuthed && (info.nickname || info.avatarUrl));
  }

  function handleAuthSuccess(info: AuthUserInfo) {
    saveToCache(info);
    if (activeInviteCode && info.inviterUserId) {
      clearStoredInviteCode();
    }
    setShowAuthModal(false);
  }

  function openNews(item: AiNewsView): void {
    Taro.navigateTo({
      url: `/pages/news-detail/index?id=${encodeURIComponent(item.id)}`,
    });
  }

  function switchFilter(filter: NewsFilterOption): void {
    setFilterOpen(false);
    if (filter.key === activeFilterKey) return;
    setActiveFilterKey(filter.key);
    void loadNews(filter.key);
  }

  function openSharePanel(item: AiNewsView, event?: { stopPropagation?: () => void }): void {
    event?.stopPropagation?.();
    setShareItem(item);
    setSharePanelVisible(true);
    enableShareMenu();
  }

  function closeSharePanel(): void {
    setSharePanelVisible(false);
  }

  function showTimelineGuide(): void {
    setSharePanelVisible(false);
    enableShareMenu();
    Taro.showToast({
      title: '请点击右上角分享到朋友圈',
      icon: 'none',
    });
  }

  return (
    <View className='page'>
      <AppTransparentHeader title='AI资讯' showBack={false} />

      <View className='news-page'>
        <View className='saas-shell news-shell'>
          <View className='news-feed'>
            {newsLoading ? (
              <>
                {[0, 1, 2].map((item) => (
                  <View className='news-card news-card--skeleton' key={item}>
                    <View className='news-card__top'>
                      <View className='news-card__title-block'>
                        <View className='news-card__meta'>
                          <View className='skeleton news-skeleton__tag' />
                          <View className='skeleton news-skeleton__time' />
                        </View>
                        <View className='skeleton news-skeleton__title' />
                      </View>
                      <View className='skeleton news-skeleton__thumb' />
                    </View>
                    <View className='skeleton news-skeleton__line' />
                    <View className='skeleton news-skeleton__line news-skeleton__line--short' />
                    <View className='news-card__foot'>
                      <View className='skeleton news-skeleton__source' />
                      <View className='skeleton news-skeleton__heat' />
                    </View>
                  </View>
                ))}
              </>
            ) : null}
            {!newsLoading && newsList.length === 0 ? (
              <View className='news-empty'>
                <Text className='news-empty__title'>暂无最新资讯</Text>
                <Text className='news-empty__desc'>运营端上传后会在这里展示。</Text>
              </View>
            ) : null}
            {newsList.map((item, index) => (
              <View className='news-card' key={item.id} onClick={() => void openNews(item)}>
                <View className='news-card__top'>
                  <View className='news-card__title-block'>
                    <View className='news-card__meta'>
                      <Text className='saas-chip news-card__tag'>AIO</Text>
                      <Text className='news-card__time'>{formatRelativeTime(item.publishedAt)}</Text>
                    </View>
                    <Text className='news-card__title'>{item.title}</Text>
                  </View>
                  {item.coverFileId ? (
                    <Image className='news-card__cover' src={item.coverFileId} mode='aspectFill' />
                  ) : (
                    <View className={`news-card__thumb news-card__thumb--${index % 2 === 0 ? 'cube' : 'desk'}`}>
                      <View className='news-card__shape' />
                    </View>
                  )}
                </View>
                <Text className='news-card__desc'>{item.summary}</Text>
                <View className='news-card__foot'>
                  <Text className='news-card__source'>{item.sourceName}{item.authorName ? ` / ${item.authorName}` : ''}</Text>
                  <View className='news-card__foot-actions'>
                    <Text className='news-card__views'>热度 {formatHeat(item.heat)}</Text>
                    <Button className='news-card__share' onClick={(event) => openSharePanel(item, event)}>
                      <View className='wechat-share-icon' />
                    </Button>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>

      {sharePanelVisible ? (
        <View className='news-share-sheet' onClick={closeSharePanel}>
          <View className='news-share-sheet__panel' onClick={(event) => event.stopPropagation()}>
            <Text className='news-share-sheet__title'>分享资讯</Text>
            <Text className='news-share-sheet__desc'>{shareItem?.title || 'AIO AI资讯'}</Text>
            <View className='news-share-sheet__actions'>
              <Button className='news-share-sheet__action' openType='share'>
                <Text className='news-share-sheet__action-icon'>友</Text>
                <Text className='news-share-sheet__action-text'>微信好友</Text>
              </Button>
              <View className='news-share-sheet__action' onClick={showTimelineGuide}>
                <Text className='news-share-sheet__action-icon'>圈</Text>
                <Text className='news-share-sheet__action-text'>朋友圈</Text>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      <View className={`news-filter-fab ${filterOpen ? 'news-filter-fab--open' : ''}`}>
        <View className='news-filter-fab__options'>
          {NEWS_FILTERS.map((filter) => (
            <Text
              key={filter.key}
              className={`news-filter-fab__option news-filter-fab__option--${filter.key} ${filter.key === activeFilterKey ? 'news-filter-fab__option--active' : ''}`}
              onClick={() => switchFilter(filter)}
            >
              {filter.label}
            </Text>
          ))}
        </View>
        <View className='news-filter-fab__button' onClick={() => setFilterOpen((value) => !value)}>
          <Text className='news-filter-fab__button-text'>{getNewsFilterLabel(activeFilterKey)}</Text>
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
