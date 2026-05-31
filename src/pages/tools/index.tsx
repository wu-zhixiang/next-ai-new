import { useEffect, useState } from 'react';
import { Button, Text, Textarea, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { callCloudFunction } from '@/services/api';
import type { MembershipView } from '@/types';
import { showTabBarSafely } from '@/utils/tabbar';

type OutputType = 'summary' | 'bullets' | 'xiaohongshu' | 'moments';

interface ToolItem {
  name: string;
  desc: string;
  badge: string;
  enabled: boolean;
}

interface ToolGroup {
  title: string;
  tools: ToolItem[];
}

interface MemberHomeResult {
  membership: MembershipView;
}

interface SummaryResult {
  title: string;
  summary: string;
  points: string[];
  outputText: string;
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    title: '内容创作',
    tools: [
      { name: '小红书文案', desc: '标题、正文、标签一键生成', badge: '待接入', enabled: false },
      { name: '朋友圈文案', desc: '活动通知、成交话术、日常种草', badge: '待接入', enabled: false },
      { name: '短视频脚本', desc: '开头钩子、分镜节奏、口播稿', badge: '待接入', enabled: false },
    ],
  },
  {
    title: '效率处理',
    tools: [
      { name: '文章总结', desc: '长文提炼重点、结论和行动建议', badge: '已上线', enabled: true },
      { name: '图片识别', desc: '截图内容识别、改写和整理', badge: '待接入', enabled: false },
      { name: '翻译润色', desc: '中英互译、语气优化、表达升级', badge: '待接入', enabled: false },
    ],
  },
];

const OUTPUT_OPTIONS: Array<{ value: OutputType; label: string }> = [
  { value: 'summary', label: '摘要' },
  { value: 'bullets', label: '要点' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'moments', label: '朋友圈' },
];

const DAILY_USAGE_KEY = 'ai_tool_daily_usage';

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function showComingSoon(name: string): void {
  void Taro.showModal({
    title: name,
    content: '工具正在接入中，后续会逐步开放。',
    showCancel: false,
    confirmText: '知道了',
  });
}

export default function ToolsPage(): JSX.Element {
  const [membershipStatus, setMembershipStatus] = useState<MembershipView['status']>('none');
  const [content, setContent] = useState('');
  const [outputType, setOutputType] = useState<OutputType>('summary');
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [todayUsed, setTodayUsed] = useState(false);
  const [adUnlocked, setAdUnlocked] = useState(false);

  useEffect(() => {
    void loadMemberStatus();
    loadDailyUsage();
  }, []);

  useDidShow(() => {
    showTabBarSafely();
  });

  async function loadMemberStatus(): Promise<void> {
    try {
      const memberResult = await callCloudFunction<MemberHomeResult>('get-member-home');
      setMembershipStatus(memberResult.membership.status);
    } catch {
      setMembershipStatus('none');
    }
  }

  function loadDailyUsage(): void {
    const record = Taro.getStorageSync(DAILY_USAGE_KEY) as { date?: string; used?: boolean };
    setTodayUsed(Boolean(record?.date === getTodayKey() && record.used));
  }

  function markDailyUsed(): void {
    Taro.setStorageSync(DAILY_USAGE_KEY, { date: getTodayKey(), used: true });
    setTodayUsed(true);
    setAdUnlocked(false);
  }

  async function unlockByAd(): Promise<boolean> {
    if (!AI_TOOL_REWARD_AD_UNIT_ID) {
      await Taro.showModal({
        title: '广告位待配置',
        content: '当前还没有配置激励视频广告位，暂时无法通过看广告解锁。',
        showCancel: false,
        confirmText: '知道了',
      });
      return false;
    }

    return new Promise((resolve) => {
      const videoAd = (Taro as typeof Taro & {
        createRewardedVideoAd: (options: { adUnitId: string }) => {
          load: () => Promise<void>;
          show: () => Promise<void>;
          onClose: (callback: (response?: { isEnded?: boolean }) => void) => void;
          onError: (callback: () => void) => void;
        };
      }).createRewardedVideoAd({ adUnitId: AI_TOOL_REWARD_AD_UNIT_ID });
      videoAd.onClose((response) => {
        const unlocked = Boolean(response?.isEnded);
        setAdUnlocked(unlocked);
        if (!unlocked) {
          void Taro.showToast({ title: '完整观看后可解锁一次', icon: 'none' });
        }
        resolve(unlocked);
      });
      videoAd.onError(() => {
        void Taro.showToast({ title: '广告加载失败', icon: 'none' });
        resolve(false);
      });
      void videoAd.load().then(() => videoAd.show()).catch(() => {
        void Taro.showToast({ title: '广告暂不可用', icon: 'none' });
        resolve(false);
      });
    });
  }

  async function ensureUsagePermission(): Promise<boolean> {
    if (membershipStatus === 'active' || membershipStatus === 'opening') {
      return true;
    }
    if (!todayUsed || adUnlocked) {
      return true;
    }
    const response = await Taro.showModal({
      title: '今日免费次数已用完',
      content: '每天可免费使用 1 次。继续使用需要观看一次激励视频。',
      confirmText: '看广告解锁',
      cancelText: '稍后再说',
    });
    if (!response.confirm) {
      return false;
    }
    return unlockByAd();
  }

  async function handleGenerate(): Promise<void> {
    const text = content.trim();
    if (text.length < 20) {
      void Taro.showToast({ title: '请至少输入 20 个字', icon: 'none' });
      return;
    }
    if (submitting) return;
    const allowed = await ensureUsagePermission();
    if (!allowed) return;

    setSubmitting(true);
    try {
      const summary = await callCloudFunction<SummaryResult>('summarize-ai-tool', {
        content: text,
        outputType,
      });
      setResult(summary);
      if (membershipStatus !== 'active' && membershipStatus !== 'opening') {
        markDailyUsed();
      }
    } catch (error) {
      void Taro.showToast({
        title: error instanceof Error ? error.message : '生成失败',
        icon: 'none',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function copyResult(): Promise<void> {
    if (!result?.outputText) return;
    await Taro.setClipboardData({ data: result.outputText });
  }

  function handleToolClick(tool: ToolItem): void {
    if (!tool.enabled) {
      showComingSoon(tool.name);
    }
  }

  const shouldShowMemberGuide = membershipStatus !== 'active' && membershipStatus !== 'opening';

  return (
    <View className='page'>
      <AppTransparentHeader title='AI工具' showBack={false} />
      <View className='tools-page'>
        <View className='saas-shell tools-shell'>
          <View className='tools-hero'>
            <View>
              <Text className='saas-chip'>效率工具箱</Text>
              <Text className='tools-hero__title'>先从文章总结开始</Text>
              <Text className='tools-hero__desc'>每天免费 1 次，用完后可看广告解锁。会员后续将获得更多工具额度。</Text>
            </View>
          </View>

          <View className='tool-workbench'>
            <View className='tool-workbench__head'>
              <View>
                <Text className='tool-workbench__eyebrow'>已上线</Text>
                <Text className='tool-workbench__title'>文章总结</Text>
              </View>
              <Text className='tool-workbench__quota'>
                {membershipStatus === 'active' || membershipStatus === 'opening'
                  ? '会员免广告'
                  : todayUsed && !adUnlocked
                    ? '需看广告'
                    : '今日可免费'}
              </Text>
            </View>

            <View className='tool-output-tabs'>
              {OUTPUT_OPTIONS.map((item) => (
                <Text
                  key={item.value}
                  className={`tool-output-tab ${outputType === item.value ? 'tool-output-tab--active' : ''}`}
                  onClick={() => setOutputType(item.value)}
                >
                  {item.label}
                </Text>
              ))}
            </View>

            <Textarea
              className='tool-input'
              maxlength={6000}
              value={content}
              placeholder='粘贴文章、帖子、会议记录或一段长文本，至少 20 个字'
              onInput={(event) => setContent(event.detail.value)}
            />
            <Button className='saas-button tool-generate-button' loading={submitting} disabled={submitting} onClick={() => void handleGenerate()}>
              {submitting ? '生成中' : '生成结果'}
            </Button>

            {result ? (
              <View className='tool-result'>
                <View className='tool-result__head'>
                  <Text className='tool-result__title'>{result.title}</Text>
                  <Text className='tool-result__copy' onClick={() => void copyResult()}>复制</Text>
                </View>
                <Text className='tool-result__summary'>{result.summary}</Text>
                {result.points.length > 0 ? (
                  <View className='tool-result__points'>
                    {result.points.map((point) => (
                      <Text className='tool-result__point' key={point}>{point}</Text>
                    ))}
                  </View>
                ) : null}
                <Text className='tool-result__output'>{result.outputText}</Text>
              </View>
            ) : null}
          </View>

          {TOOL_GROUPS.map((group) => (
            <View className='tools-section' key={group.title}>
              <Text className='tools-section__title'>{group.title}</Text>
              <View className='tools-grid'>
                {group.tools.map((tool) => (
                  <View
                    className={`tool-card ${tool.enabled ? 'tool-card--enabled' : 'tool-card--disabled'}`}
                    key={tool.name}
                    onClick={() => handleToolClick(tool)}
                  >
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

          {shouldShowMemberGuide ? (
            <View className='tools-member'>
              <View>
                <Text className='tools-member__title'>Open AI 资讯会员</Text>
                <Text className='tools-member__desc'>后续工具额度、高级模板和记录保存将作为会员权益开放。</Text>
              </View>
              <Text className='tools-member__button' onClick={() => Taro.switchTab({ url: '/pages/member/index' })}>去开通</Text>
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}
