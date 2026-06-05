import { useEffect, useMemo, useState } from 'react';
import { Button, Text, Textarea, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { callCloudFunction } from '@/services/api';
import type { MembershipView } from '@/types';
import { getToolById, type OutputType } from '@/pages/tools/definitions';

interface MemberHomeResult {
  membership: MembershipView;
}

interface SummaryResult {
  title: string;
  summary: string;
  points: string[];
  outputText: string;
}

const OUTPUT_OPTIONS: Array<{ value: OutputType; label: string }> = [
  { value: 'summary', label: '摘要' },
  { value: 'bullets', label: '要点' },
  { value: 'xiaohongshu', label: '小红书' },
  { value: 'moments', label: '朋友圈' },
];

const PROMPT_PRESETS: Array<{ label: string; outputType: OutputType }> = [
  {
    label: '资讯速读',
    outputType: 'summary',
  },
  {
    label: '行动清单',
    outputType: 'bullets',
  },
  {
    label: '小红书',
    outputType: 'xiaohongshu',
  },
  {
    label: '朋友圈',
    outputType: 'moments',
  },
];

const DAILY_USAGE_KEY = 'ai_tool_daily_usage';
const LEGACY_PROMPT_PREFIXES = [
  '请帮我总结这篇 AI 资讯，突出核心变化、影响范围和普通用户应该关注的点：',
  '请把下面内容整理成行动清单，按优先级输出，避免空泛建议：',
  '请把下面内容改写成克制可信的小红书风格文案，包含标题、正文和标签：',
  '请把下面内容改写成适合朋友圈发布的短文案，语气自然、有信息密度：',
];

function getTodayKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
}

function isMember(status: MembershipView['status']): boolean {
  return status === 'active' || status === 'opening';
}

function stripLegacyPromptPrefixes(value: string): string {
  return LEGACY_PROMPT_PREFIXES.reduce(
    (next, prefix) => next.split(prefix).join(''),
    value,
  ).trim();
}

export default function ToolDetailPage(): JSX.Element {
  const [toolId, setToolId] = useState('');
  const [membershipStatus, setMembershipStatus] = useState<MembershipView['status']>('none');
  const [content, setContent] = useState('');
  const [outputType, setOutputType] = useState<OutputType>('summary');
  const [result, setResult] = useState<SummaryResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [todayUsed, setTodayUsed] = useState(false);
  const [adUnlocked, setAdUnlocked] = useState(false);

  const activeTool = useMemo(() => getToolById(toolId), [toolId]);
  const memberActive = isMember(membershipStatus);

  useLoad((options) => {
    const nextTool = getToolById(typeof options.tool === 'string' ? options.tool : '');
    setToolId(nextTool.id);
    setOutputType(nextTool.outputType);
    void loadMemberStatus();
    loadDailyUsage();
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
    if (memberActive) {
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

  function applyPreset(preset: typeof PROMPT_PRESETS[number]): void {
    setOutputType(preset.outputType);
    setResult(null);
  }

  function changeOutputType(nextOutputType: OutputType): void {
    setOutputType(nextOutputType);
    setResult(null);
  }

  async function handleGenerate(): Promise<void> {
    const text = stripLegacyPromptPrefixes(content);
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
      if (!memberActive) {
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

  function clearContent(): void {
    setContent('');
    setResult(null);
  }

  return (
    <View className='page'>
      <AppTransparentHeader title={activeTool.name} />
      <View className='tools-page'>
        <View className='saas-shell tools-shell'>
          <View className='tool-detail-hero'>
            <View className='tool-card__icon tool-detail-hero__icon'>{activeTool.icon}</View>
            <View>
              <Text className='tool-detail-hero__title'>{activeTool.name}</Text>
              <Text className='tool-detail-hero__desc'>{activeTool.desc}</Text>
            </View>
            <Text className='tool-workbench__quota'>
              {memberActive ? '会员免广告' : todayUsed && !adUnlocked ? '需看广告' : '今日可免费'}
            </Text>
          </View>

          <View className='tool-workbench tool-workbench--detail'>
            <Text className='tool-ai-notice'>AI生成内容，仅供参考。</Text>

            {/* <View className='tool-preset-row'>
              {PROMPT_PRESETS.map((preset) => (
                <Text className='tool-preset-chip' key={preset.label} onClick={() => applyPreset(preset)}>
                  {preset.label}
                </Text>
              ))}
            </View> */}

            <View className='tool-output-tabs'>
              {OUTPUT_OPTIONS.map((item) => (
                <Text
                  key={item.value}
                  className={`tool-output-tab ${outputType === item.value ? 'tool-output-tab--active' : ''}`}
                  onClick={() => changeOutputType(item.value)}
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

            <View className='tool-action-row'>
              <Button className='saas-button tool-generate-button' loading={submitting} disabled={submitting} onClick={() => void handleGenerate()}>
                {submitting ? '生成中' : '生成结果'}
              </Button>
              <Text className='tool-clear-button' onClick={clearContent}>清空</Text>
            </View>

            {result ? (
              <View className='tool-result'>
                <Text className='tool-result__ai-badge'>AI生成内容</Text>
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
        </View>
      </View>
    </View>
  );
}
