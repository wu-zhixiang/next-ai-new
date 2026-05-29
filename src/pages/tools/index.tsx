import { Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { showTabBarSafely } from '@/utils/tabbar';

const TOOL_GROUPS = [
  {
    title: '内容创作',
    tools: [
      {
        name: '小红书文案',
        desc: '标题、正文、标签一键生成',
        badge: '热门',
      },
      {
        name: '朋友圈文案',
        desc: '活动通知、成交话术、日常种草',
        badge: '微信场景',
      },
      {
        name: '短视频脚本',
        desc: '开头钩子、分镜节奏、口播稿',
        badge: '增长',
      },
    ],
  },
  {
    title: '效率处理',
    tools: [
      {
        name: '文章总结',
        desc: '长文提炼重点、结论和行动建议',
        badge: '省时间',
      },
      {
        name: '图片识别',
        desc: '截图内容识别、改写和整理',
        badge: '待接入',
      },
      {
        name: '翻译润色',
        desc: '中英互译、语气优化、表达升级',
        badge: '办公',
      },
    ],
  },
];

function showComingSoon(name: string): void {
  void Taro.showModal({
    title: name,
    content: '工具正在接入中，后续将支持会员直接使用。',
    showCancel: false,
    confirmText: '知道了',
  });
}

export default function ToolsPage(): JSX.Element {
  useDidShow(() => {
    showTabBarSafely();
  });

  return (
    <View className='page'>
      <AppTransparentHeader title='AI工具' showBack={false} />
      <View className='tools-page'>
        <View className='saas-shell tools-shell'>
          <View className='tools-hero'>
            <View>
              <Text className='saas-chip'>效率工具箱</Text>
              <Text className='tools-hero__title'>把 AI 用到每天的内容和工作里</Text>
              <Text className='tools-hero__desc'>从文案生成、资料总结到图片识别，优先上线最常用的 AI 场景。</Text>
            </View>
          </View>

          {TOOL_GROUPS.map((group) => (
            <View className='tools-section' key={group.title}>
              <Text className='tools-section__title'>{group.title}</Text>
              <View className='tools-grid'>
                {group.tools.map((tool) => (
                  <View className='tool-card' key={tool.name} onClick={() => showComingSoon(tool.name)}>
                    <View className='tool-card__head'>
                      <Text className='tool-card__icon'>{tool.name.slice(0, 1)}</Text>
                      <Text className='tool-card__badge'>{tool.badge}</Text>
                    </View>
                    <Text className='tool-card__title'>{tool.name}</Text>
                    <Text className='tool-card__desc'>{tool.desc}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <View className='tools-member'>
            <View>
              <Text className='tools-member__title'>Open AI 资讯会员</Text>
              <Text className='tools-member__desc'>后续工具额度、高级模板和记录保存将作为会员权益开放。</Text>
            </View>
            <Text className='tools-member__button' onClick={() => Taro.switchTab({ url: '/pages/member/index' })}>去开通</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
