import { useState } from 'react';
import { Image, ScrollView, Swiper, SwiperItem, Text, View } from '@tarojs/components';
import Taro, { useDidShow, useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { SaasPageFrame } from '@/components/SaasPageFrame';
import { Skeleton } from '@/components/Skeleton';
import AuthModal, { type AuthUserInfo } from '@/components/AuthModal';
import { callCloudFunction } from '@/services/api';
import type { AiNewsView, ProductTypeView } from '@/types';
import { useResetPageScroll } from '@/hooks/useResetPageScroll';
import { showTabBarSafely } from '@/utils/tabbar';
import { setPromotedProductCode } from '@/utils/productNavigation';
import { VISIBLE_TOOLS, getToolEntryUrl, type ToolDefinition } from '@/pages/tools/definitions';
import { loadClientAppConfig } from '@/utils/appConfig';
import { toCompliantProductType } from '@/utils/productCompliance';
import { getCachedUserInfo, saveCachedUserInfo } from '@/utils/auth';
import { hasAuthConsent } from '@/utils/authConsent';
import { clearStoredInviteCode, resolveInviteCode } from '@/utils/invite';

const CHEVRON_RIGHT_ICON = require('../../assets/icons/chevron-right-terracotta.svg') as string;
const SECTION_MORE_CHEVRON_ICON = require('../../assets/icons/chevron-right-home-section.svg') as string;
const HOME_TOOLS = VISIBLE_TOOLS.filter((tool) => tool.enabled).slice(0, 3);

interface ProductTypeListResult {
  productTypes: ProductTypeView[];
}

interface NewsListResult {
  items: AiNewsView[];
}

function formatRelativeTime(value: number): string {
  const diff = Math.max(0, Date.now() - value);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)}小时前`;
  return `${Math.floor(diff / day)}天前`;
}

export default function HomePage(): JSX.Element {
  const pageScroll = useResetPageScroll();
  const router = useRouter();

  const [productTypes, setProductTypes] = useState<ProductTypeView[]>([]);
  const [news, setNews] = useState<AiNewsView[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeInviteCode, setActiveInviteCode] = useState('');

  useDidShow(() => {
    showTabBarSafely();
    enableShareMenu();
    void loadHome(!hasLoaded);
  });

  useShareAppMessage(() => ({
    title: 'AIO AI资讯会员',
    path: '/pages/home/index',
  }));

  useShareTimeline(() => ({
    title: 'AIO AI资讯会员',
    query: '',
  }));

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

  async function loadHome(showSkeleton = false): Promise<void> {
    if (showSkeleton) {
      setLoading(true);
    }
    try {
      const inviteCode = resolveInviteCode(router.params);
      setActiveInviteCode(inviteCode);
      const [config, productResult, newsResult] = await Promise.all([
        loadClientAppConfig(),
        callCloudFunction<ProductTypeListResult>('list-product-types').catch(() => ({ productTypes: [] })),
        callCloudFunction<NewsListResult>('list-ai-news', {
          limit: 5,
          offset: 0,
          sort: 'latest',
        }).catch(() => ({ items: [] })),
      ]);
      setShowAuthModal(
        config.enableHomeAuthModal
        && !hasAuthConsent(getCachedUserInfo()),
      );
      setProductTypes(
        config.enableProductComplianceMode
          ? productResult.productTypes
              .map(toCompliantProductType)
              .filter((item): item is ProductTypeView => Boolean(item))
          : productResult.productTypes,
      );
      setNews(newsResult.items.slice(0, 5));
    } finally {
      setHasLoaded(true);
      setLoading(false);
    }
  }

  function openMemberCenter(productCode?: string): void {
    if (productCode) {
      setPromotedProductCode(productCode);
    }
    void Taro.switchTab({ url: '/pages/member/index' });
  }

  function openNewsList(): void {
    void Taro.navigateTo({ url: '/pages/news/index' });
  }

  function openTools(): void {
    void Taro.switchTab({ url: '/pages/tools/index' });
  }

  function openNews(item: AiNewsView): void {
    void Taro.navigateTo({
      url: `/pages/news-detail/index?id=${encodeURIComponent(item.id)}`,
    });
  }

  function openTool(tool: ToolDefinition): void {
    void Taro.navigateTo({
      url: getToolEntryUrl(tool),
    });
  }

  function handleAuthSuccess(info: AuthUserInfo): void {
    saveCachedUserInfo(info);
    if (activeInviteCode && info.inviterUserId) {
      clearStoredInviteCode();
    }
    setShowAuthModal(false);
  }

  return (
    <>
      <SaasPageFrame title='首页' showBack={false}>
        <ScrollView
          className='home-page-v2'
          scrollY
          scrollTop={pageScroll.scrollTop}
          showScrollbar={false}
        >
          <View className='saas-shell home-page-v2__shell'>
          {loading ? (
            <View className='home-banner home-banner--skeleton'>
              <View className='home-banner__copy'>
                <Skeleton width='132rpx' height='32rpx' />
                <Skeleton width='310rpx' height='52rpx' radius='14rpx' />
                <Skeleton width='360rpx' height='28rpx' radius='10rpx' />
                <Skeleton width='160rpx' height='58rpx' />
              </View>
              <Skeleton className='home-banner__image-skeleton' width='190rpx' height='190rpx' />
            </View>
          ) : productTypes.length > 0 ? (
            <View className='home-banner-wrap'>
              <Swiper
                className='home-banner-swiper'
                autoplay={productTypes.length > 1}
                circular={productTypes.length > 1}
                interval={4500}
                duration={420}
                current={bannerIndex}
                onChange={(event) => setBannerIndex(event.detail.current)}
              >
                {productTypes.map((product) => (
                  <SwiperItem key={product.productCode}>
                    <View className='home-banner' onClick={() => openMemberCenter(product.productCode)}>
                      <View className='home-banner__copy'>
                        <Text className='home-banner__tag'>{product.tag}</Text>
                        <Text className='home-banner__title'>{product.label || product.productName}</Text>
                        <Text className='home-banner__desc'>{product.description}</Text>
                        <View className='home-banner__action'>
                          <Text>查看会员方案</Text>
                          <Image className='home-inline-chevron' src={CHEVRON_RIGHT_ICON} mode='aspectFit' />
                        </View>
                      </View>
                      <View className='home-banner__visual'>
                        {product.avatarUrl ? (
                          <Image className='home-banner__image' src={product.avatarUrl} mode='aspectFill' />
                        ) : (
                          <Text className='home-banner__fallback'>{product.label.slice(0, 1)}</Text>
                        )}
                      </View>
                    </View>
                  </SwiperItem>
                ))}
              </Swiper>
              {productTypes.length > 1 ? (
                <View className='home-banner-dots'>
                  {productTypes.map((product, index) => (
                    <Text
                      key={product.productCode}
                      className={`home-banner-dot ${index === bannerIndex ? 'home-banner-dot--active' : ''}`}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ) : (
            <View className='home-banner home-banner--empty' onClick={() => openMemberCenter()}>
              <View className='home-banner__copy'>
                <Text className='home-banner__tag'>AI会员</Text>
                <Text className='home-banner__title'>选择适合你的 AI 服务</Text>
                <Text className='home-banner__desc'>查看当前可购买的会员商品与套餐。</Text>
                <View className='home-banner__action'>
                  <Text>立即查看</Text>
                  <Image className='home-inline-chevron' src={CHEVRON_RIGHT_ICON} mode='aspectFit' />
                </View>
              </View>
            </View>
          )}

          <View className='home-section home-tools-section'>
            <View className='home-section__head'>
              <Text className='home-section__title'>AI工具</Text>
              <View className='home-section__more' onClick={openTools}>
                <Text>更多工具</Text>
                <Image className='home-inline-chevron' src={SECTION_MORE_CHEVRON_ICON} mode='aspectFit' />
              </View>
            </View>
            <View className='home-tools'>
              {HOME_TOOLS.map((tool) => (
                <View className='home-tool' key={tool.id} onClick={() => openTool(tool)}>
                  <View className='home-tool__icon'>
                    <Text>{tool.icon}</Text>
                  </View>
                  <View className='home-tool__copy'>
                    <Text className='home-tool__title'>{tool.name}</Text>
                    <Text className='home-tool__desc'>{tool.desc}</Text>
                  </View>
                  <Image className='home-tool__chevron' src={CHEVRON_RIGHT_ICON} mode='aspectFit' />
                </View>
              ))}
            </View>
          </View>

          <View className='home-section home-news-section'>
            <View className='home-section__head'>
              <Text className='home-section__title'>AI资讯</Text>
              <View className='home-section__more' onClick={openNewsList}>
                <Text>更多资讯</Text>
                <Image className='home-inline-chevron' src={SECTION_MORE_CHEVRON_ICON} mode='aspectFit' />
              </View>
            </View>
            {loading ? (
              <View className='home-news-list'>
                {[0, 1, 2, 3, 4].map((item) => (
                  <View className='home-news-item' key={item}>
                    <View className='home-news-item__copy'>
                      <Skeleton width='100%' height='30rpx' radius='10rpx' />
                      <Skeleton width='78%' height='30rpx' radius='10rpx' />
                      <Skeleton width='180rpx' height='22rpx' radius='8rpx' />
                    </View>
                    <Skeleton width='136rpx' height='102rpx' radius='20rpx' />
                  </View>
                ))}
              </View>
            ) : news.length > 0 ? (
              <View className='home-news-list'>
                {news.map((item) => (
                  <View className='home-news-item' key={item.id} onClick={() => openNews(item)}>
                    <View className='home-news-item__copy'>
                      <Text className='home-news-item__title'>{item.title}</Text>
                      <Text className='home-news-item__meta'>
                        {item.sourceName} · {formatRelativeTime(item.publishedAt)}
                      </Text>
                    </View>
                    {item.coverFileId ? (
                      <Image className='home-news-item__image' src={item.coverFileId} mode='aspectFill' />
                    ) : (
                      <View className='home-news-item__placeholder'>
                        <Text>AI</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View className='home-news-empty'>
                <Text>暂无最新资讯</Text>
              </View>
            )}
          </View>
          </View>
        </ScrollView>
      </SaasPageFrame>
      <AuthModal
        visible={showAuthModal}
        inviteCode={activeInviteCode}
        onAuthSuccess={handleAuthSuccess}
      />
    </>
  );
}
