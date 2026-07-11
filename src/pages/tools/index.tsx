import { Image, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
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

export default function ToolsPage(): JSX.Element {
  useResetPageScroll();
  const [tools, setTools] = useState<ToolDefinition[]>(sortToolDefinitions(VISIBLE_TOOLS));
  const requestStateRef = useRef({ inFlight: false, lastRequestedAt: 0 });
  const featuredTool = tools[0];
  const otherTools = featuredTool ? tools.slice(1) : tools;

  const refreshTools = useCallback(async (source: string): Promise<void> => {
    const now = Date.now();
    const requestState = requestStateRef.current;
    if (requestState.inFlight || now - requestState.lastRequestedAt < 500) {
      return;
    }
    requestStateRef.current = { inFlight: true, lastRequestedAt: now };
    try {
      const nextTools = await loadConfiguredTools(source);
      setTools(nextTools.filter((item) => item.visible !== false));
    } finally {
      requestStateRef.current = { inFlight: false, lastRequestedAt: Date.now() };
    }
  }, []);

  useEffect(() => {
    void refreshTools('tools-page:mount');
  }, [refreshTools]);

  useDidShow(() => {
    showTabBarSafely();
    void refreshTools('tools-page:show');
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
          {featuredTool ? (
            <View
              className={`tools-hero tools-hero--featured ${isToolDisabled(featuredTool) ? 'tools-hero--disabled' : ''}`}
              onClick={() => openTool(featuredTool)}
            >
              <View className='tools-hero__copy'>
                <View className='tools-hero__label-row'>
                  <Text className='tools-hero__label'>热门工具</Text>
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

          {otherTools.length ? <View className='tools-section'>
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
