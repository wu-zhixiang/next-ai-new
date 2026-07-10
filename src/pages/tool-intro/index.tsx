import { useMemo, useState } from 'react';
import { Button, Text, View } from '@tarojs/components';
import Taro, { useLoad, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { useResetPageScroll } from '@/hooks/useResetPageScroll';
import { getToolById, getToolDetailUrl, hasToolIntro } from '@/pages/tools/definitions';

export default function ToolIntroPage(): JSX.Element {
  useResetPageScroll();

  const [toolId, setToolId] = useState('');
  const activeTool = useMemo(() => getToolById(toolId), [toolId]);
  const intro = activeTool.intro;

  useLoad((options) => {
    const nextTool = getToolById(typeof options.tool === 'string' ? options.tool : '');
    setToolId(nextTool.id);
    if (!hasToolIntro(nextTool)) {
      void Taro.redirectTo({ url: getToolDetailUrl(nextTool.id) });
    }
  });

  useShareAppMessage(() => ({
    title: intro?.title || `${activeTool.name} - AIO AI工具`,
    path: `/pages/tool-intro/index?tool=${encodeURIComponent(activeTool.id)}`,
  }));

  useShareTimeline(() => ({
    title: intro?.title || `${activeTool.name} - AIO AI工具`,
    query: `tool=${encodeURIComponent(activeTool.id)}`,
  }));

  function startTool(): void {
    void Taro.navigateTo({ url: getToolDetailUrl(activeTool.id) });
  }

  if (!intro) {
    return (
      <View className='page'>
        <AppTransparentHeader title={activeTool.name} />
      </View>
    );
  }

  return (
    <View className='page tool-intro-page'>
      <AppTransparentHeader title={activeTool.name} />
      <View className='tools-page'>
        <View className='saas-shell tool-intro-shell'>
          <View className='tool-intro-hero'>
            <View className='tool-intro-hero__copy'>
              <Text className='saas-chip'>{intro.eyebrow}</Text>
              <Text className='tool-intro-hero__title'>{intro.title}</Text>
              <Text className='tool-intro-hero__subtitle'>{intro.subtitle}</Text>
            </View>
            <View className='tool-intro-hero__mark'>
              <Text>{activeTool.icon}</Text>
            </View>
          </View>

          <View className='tool-intro-section'>
            <Text className='tool-intro-section__title'>适合处理</Text>
            <View className='tool-intro-highlights'>
              {intro.highlights.map((item) => (
                <View className='tool-intro-highlight' key={item.title}>
                  <Text className='tool-intro-highlight__title'>{item.title}</Text>
                  <Text className='tool-intro-highlight__desc'>{item.desc}</Text>
                </View>
              ))}
            </View>
          </View>

          <View className='tool-intro-section'>
            <Text className='tool-intro-section__title'>案例展示</Text>
            <View className='tool-intro-cases'>
              {intro.cases.map((item) => (
                <View className='tool-intro-case' key={item.title}>
                  <Text className='tool-intro-case__title'>{item.title}</Text>
                  <View className='tool-intro-case__compare'>
                    <View className='tool-intro-case__side'>
                      <Text className='tool-intro-case__label'>处理前</Text>
                      <Text className='tool-intro-case__text'>{item.before}</Text>
                    </View>
                    <View className='tool-intro-case__side tool-intro-case__side--after'>
                      <Text className='tool-intro-case__label'>处理后</Text>
                      <Text className='tool-intro-case__text'>{item.after}</Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          </View>

          {intro.tips?.length ? (
            <View className='tool-intro-section'>
              <Text className='tool-intro-section__title'>使用前确认</Text>
              <View className='tool-intro-tips'>
                {intro.tips.map((item) => (
                  <Text className='tool-intro-tip' key={item}>{item}</Text>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </View>

      <View className='tool-intro-usebar'>
        <Button className='saas-button tool-intro-usebar__button' onClick={startTool}>
          立即使用
        </Button>
      </View>
    </View>
  );
}
