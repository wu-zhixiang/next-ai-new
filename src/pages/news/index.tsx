import { Button, Text, View } from '@tarojs/components';
import { SaasPageFrame } from '@/components/SaasPageFrame';

const NEWS = [
  {
    tag: '大模型',
    time: '2小时前',
    title: 'OpenAI 发布全新推理模型 o1',
    desc: '强化逻辑思维与复杂问题解决能力，开启通用人工智能新篇章。',
    source: 'AI资讯',
    views: '8.2k',
    tone: 'cube',
  },
  {
    tag: '工具',
    time: '5小时前',
    title: 'Notion AI 迎来史诗级更新',
    desc: '全面接入多模态理解能力，实现跨文档上下文深度整合与内容自动生成。',
    source: '科技评论',
    views: '5.4k',
    tone: 'desk',
  },
];

export default function NewsPage(): JSX.Element {
  return (
    <SaasPageFrame title='AI资讯' showBack={false}>
      <View className='news-page'>

      <View className='saas-shell news-shell'>
        <View className='news-hero'>
          <View className='news-hero__art'>
            <View className='news-hero__orb news-hero__orb--one' />
            <View className='news-hero__orb news-hero__orb--two' />
          </View>
          <View className='news-hero__content'>
            <Text className='saas-chip'>Editor's Pick</Text>
            <Text className='news-hero__title'>深度：生成式AI如何重塑2024年的生产力工具</Text>
            <Text className='news-hero__desc'>探讨最新的AI技术如何无缝融入日常工作流，从根本上改变企业效率与个人创作方式。</Text>
            <Button className='saas-button news-hero__button'>去订阅</Button>
          </View>
          
        </View>

        <View className='news-feed'>
          {NEWS.map((item) => (
            <View key={item.title} className='news-card'>
              <View className='news-card__body'>
                <View className='news-card__meta'>
                  <Text className='saas-chip news-card__tag'>{item.tag}</Text>
                  <Text className='news-card__time'>{item.time}</Text>
                </View>
                <Text className='news-card__title'>{item.title}</Text>
                <Text className='news-card__desc'>{item.desc}</Text>
                <View className='news-card__foot'>
                  <Text className='news-card__source'>{item.source}</Text>
                  <Text className='news-card__views'>{item.views}</Text>
                </View>
              </View>
              <View className={`news-card__thumb news-card__thumb--${item.tone}`}>
                <View className='news-card__shape' />
              </View>
            </View>
          ))}
        </View>
      </View>

      </View>
    </SaasPageFrame>
  );
}
