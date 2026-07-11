import { Image, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useCallback, useRef, useState } from 'react';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { Skeleton } from '@/components/Skeleton';
import { showTabBarSafely } from '@/utils/tabbar';
import { useResetPageScroll } from '@/hooks/useResetPageScroll';
import { VISIBLE_TOOLS, getToolEntryUrl, getToolTags, hasToolIntro, isToolDisabled, sortToolDefinitions, type ToolDefinition } from './definitions';
import { loadConfiguredTools } from './runtime';

function showComingSoon(tool: ToolDefinition): void {
  void Taro.showModal({
    title: tool.name,
    content: `${tool.desc}还在接入中，暂时不可使用。`,
    showCancel: false,
    confirmText: '知道了',
  });
}

function ToolsPageSkeleton(): JSX.Element {
  return (
    <View className='tools-page-skeleton' aria-busy='true'>
      <View className='tools-hero tools-hero--skeleton'>
        <View className='tools-hero__copy'>
          <View className='tools-hero__label-row'>
            <Skeleton width='104rpx' height='30rpx' radius='12rpx' />
            <Skeleton width='92rpx' height='30rpx' />
            <Skeleton width='76rpx' height='30rpx' />
          </View>
          <Skeleton className='tools-hero-skeleton__title' width='250rpx' height='50rpx' radius='14rpx' />
          <Skeleton className='tools-hero-skeleton__line' width='360rpx' height='28rpx' radius='10rpx' />
          <Skeleton className='tools-hero-skeleton__line' width='300rpx' height='28rpx' radius='10rpx' />
        </View>
        <Skeleton className='tools-hero__featured-icon tools-hero__featured-icon--skeleton' width='180rpx' height='180rpx' />
      </View>

      <View className='tools-section tools-section--skeleton'>
        <View className='tools-section__head'>
          <Skeleton width='132rpx' height='42rpx' radius='14rpx' />
          <Skeleton width='176rpx' height='30rpx' radius='12rpx' />
        </View>
        <View className='tools-grid'>
          {[0, 1, 2, 3].map((item) => (
            <View className='tool-card tool-card--skeleton' key={item}>
              <View className='tool-card__head'>
                <Skeleton width='56rpx' height='56rpx' radius='18rpx' />
                <Skeleton width='96rpx' height='34rpx' />
              </View>
              <Skeleton className='tool-card-skeleton__title' width='170rpx' height='34rpx' radius='12rpx' />
              <Skeleton className='tool-card-skeleton__line' width='100%' height='24rpx' radius='10rpx' />
              <Skeleton className='tool-card-skeleton__line' width='76%' height='24rpx' radius='10rpx' />
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

export default function ToolsPage(): JSX.Element {
  useResetPageScroll();
  const [tools, setTools] = useState<ToolDefinition[]>(sortToolDefinitions(VISIBLE_TOOLS));
  const [loading, setLoading] = useState(true);
  const hasLoadedRef = useRef(false);
  const requestStateRef = useRef({ inFlight: false, lastRequestedAt: 0 });
  const featuredTool = tools[0];
  const otherTools = featuredTool ? tools.slice(1) : tools;

  const refreshTools = useCallback(async (source: string, showSkeleton = false): Promise<void> => {
    const now = Date.now();
    const requestState = requestStateRef.current;
    if (requestState.inFlight || now - requestState.lastRequestedAt < 500) {
      return;
    }
    if (showSkeleton) {
      setLoading(true);
    }
    requestStateRef.current = { inFlight: true, lastRequestedAt: now };
    try {
      const nextTools = await loadConfiguredTools(source);
      setTools(nextTools.filter((item) => item.visible !== false));
    } finally {
      hasLoadedRef.current = true;
      setLoading(false);
      requestStateRef.current = { inFlight: false, lastRequestedAt: Date.now() };
    }
  }, []);

  useDidShow(() => {
    showTabBarSafely();
    void refreshTools(
      hasLoadedRef.current ? 'tools-page:show' : 'tools-page:first-show',
      !hasLoadedRef.current,
    );
  });

  function openTool(tool: ToolDefinition): void {
    if (isToolDisabled(tool) || (!tool.enabled && !hasToolIntro(tool))) {
      showComingSoon(tool);
      return;
    }
    void Taro.navigateTo({
      url: getToolEntryUrl(tool),
    });
  }

  return (
    <View className='page'>
      <AppTransparentHeader title='AI工具' showBack={false} />
      <View className='tools-page'>
        <View className='saas-shell tools-shell'>
          {loading ? <ToolsPageSkeleton /> : null}

          {!loading && featuredTool ? (
            <View
              className={`tools-hero tools-hero--featured ${isToolDisabled(featuredTool) ? 'tools-hero--disabled' : ''}`}
              onClick={() => openTool(featuredTool)}
            >
              <View className='tools-hero__copy'>
                <View className='tools-hero__label-row'>
                  {/* <Text className='tools-hero__label'>热门工具</Text> */}
                  <View className='tools-hero__tags'>
                    {getToolTags(featuredTool).slice(0, 3).map((tag) => (
                      <Text className='tools-hero__tag' key={tag}>{tag}</Text>
                    ))}
                  </View>
                </View>
                <Text className='tools-hero__title'>{featuredTool.name}</Text>
                <Text className='tools-hero__desc'>{featuredTool.desc}</Text>
              </View>
              <View className='tools-hero__featured-icon'>
                {featuredTool.iconImageFileId
                  ? <Image className='tools-hero__featured-image' src={featuredTool.iconImageFileId} mode='aspectFit' />
                  : <Text>{featuredTool.icon}</Text>}
              </View>
            </View>
          ) : null}

          {!loading && otherTools.length ? <View className='tools-section'>
            <View className='tools-section__head'>
              <Text className='tools-section__title'>选择工具</Text>
              <Text className='tools-section__hint'>点击进入独立工具页</Text>
            </View>
            <View className='tools-grid'>
              {otherTools.map((tool) => {
                const disabled = isToolDisabled(tool);
                return (
                  <View
                    className={`tool-card ${disabled ? 'tool-card--disabled' : tool.enabled ? 'tool-card--enabled' : hasToolIntro(tool) ? 'tool-card--intro' : 'tool-card--disabled'}`}
                    key={tool.id}
                    onClick={() => openTool(tool)}
                  >
                    <View className='tool-card__head'>
                      <View className='tool-card__icon'>
                        {tool.iconImageFileId
                          ? <Image className='tool-card__icon-image' src={tool.iconImageFileId} mode='aspectFit' />
                          : <Text>{tool.icon}</Text>}
                      </View>
                      <Text className='tool-card__badge'>{getToolTags(tool)[0] ?? tool.badge}</Text>
                    </View>
                    <Text className='tool-card__title'>{tool.name}</Text>
                    <Text className='tool-card__desc'>{tool.desc}</Text>
                  </View>
                );
              })}
            </View>
          </View> : null}
        </View>
      </View>
    </View>
  );
}
