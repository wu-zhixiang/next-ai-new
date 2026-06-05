import { Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { showTabBarSafely } from '@/utils/tabbar';
import { TOOLS, type ToolDefinition } from './definitions';

function showComingSoon(tool: ToolDefinition): void {
  void Taro.showModal({
    title: tool.name,
    content: `${tool.desc}能力正在接入中，当前先开放文章总结和文案生成。`,
    showCancel: false,
    confirmText: '知道了',
  });
}

export default function ToolsPage(): JSX.Element {
  useDidShow(() => {
    showTabBarSafely();
  });

  function openTool(tool: ToolDefinition): void {
    if (!tool.enabled) {
      showComingSoon(tool);
      return;
    }
    void Taro.navigateTo({
      url: `/pages/tool-detail/index?tool=${encodeURIComponent(tool.id)}`,
    });
  }

  return (
    <View className='page'>
      <AppTransparentHeader title='AI工具' showBack={false} />
      <View className='tools-page'>
        <View className='saas-shell tools-shell'>
          <View className='tools-hero'>
            <View>
              <Text className='saas-chip'>AI工具箱</Text>
              <Text className='tools-hero__title'>内容整理与创作</Text>
              <Text className='tools-hero__desc'>先开放文章总结和文案生成。后续接入图像生成、图片编辑、翻译润色等能力。</Text>
            </View>
            <View className='tools-hero__meter'>
              <Text className='tools-hero__meter-value'>1次</Text>
              <Text className='tools-hero__meter-label'>每日免费</Text>
            </View>
          </View>

          <View className='tools-section'>
            <View className='tools-section__head'>
              <Text className='tools-section__title'>选择工具</Text>
              <Text className='tools-section__hint'>点击进入独立工具页</Text>
            </View>
            <View className='tools-grid'>
              {TOOLS.map((tool) => (
                <View
                  className={`tool-card ${tool.enabled ? 'tool-card--enabled' : 'tool-card--disabled'}`}
                  key={tool.id}
                  onClick={() => openTool(tool)}
                >
                  <View className='tool-card__head'>
                    <Text className='tool-card__icon'>{tool.icon}</Text>
                    <Text className='tool-card__badge'>{tool.badge}</Text>
                  </View>
                  <Text className='tool-card__title'>{tool.name}</Text>
                  <Text className='tool-card__desc'>{tool.desc}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
