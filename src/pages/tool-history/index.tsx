import { useState } from 'react';
import { Button, Image, Text, View } from '@tarojs/components';
import Taro, { useLoad, usePullDownRefresh, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { AppTransparentHeader } from '@/components/AppTransparentHeader';
import { SkeletonOrderList } from '@/components/Skeleton';
import { callCloudFunction } from '@/services/api';
import { TOOLS, getToolByIdFromList, isToolId, type ToolId } from '@/pages/tools/definitions';
import { formatDateTime } from '@/utils/format';
import { useResetPageScroll } from '@/hooks/useResetPageScroll';

type RunStatus = 'processing' | 'succeeded' | 'failed';

interface ToolRun {
  runId: string;
  status: RunStatus;
  toolId: string;
  title: string;
  summary?: string;
  outputText?: string;
  outputImages?: Array<{
    fileId: string;
    url?: string;
    width?: number;
    height?: number;
  }>;
  createdAt: number;
}

interface ListAiToolRunsResult {
  runs: ToolRun[];
}

const STATUS_LABEL: Record<RunStatus, string> = {
  processing: '处理中',
  succeeded: '已完成',
  failed: '失败',
};

function getStatusClass(status: RunStatus): string {
  if (status === 'processing') {
    return 'opening';
  }
  if (status === 'succeeded') {
    return 'paid';
  }
  return 'failed';
}

export default function ToolHistoryPage(): JSX.Element {
  useResetPageScroll();

  const [toolId, setToolId] = useState<ToolId>(TOOLS[0]?.id ?? 'articleSummary');
  const [runs, setRuns] = useState<ToolRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [shareRun, setShareRun] = useState<ToolRun | null>(null);
  const [sharePanelVisible, setSharePanelVisible] = useState(false);

  const activeTool = getToolByIdFromList(TOOLS, toolId) || TOOLS[0];
  const imageHistoryTool = activeTool?.id === 'imageRepair' || activeTool?.id === 'imageGenerate';

  useLoad((options) => {
    enableShareMenu();
    const nextToolId = typeof options.tool === 'string' && isToolId(options.tool) ? options.tool : toolId;
    setToolId(nextToolId);
    void loadRuns(nextToolId);
  });

  useShareAppMessage(() => getShareAppMessage(shareRun));

  useShareTimeline(() => getShareTimeline(shareRun));

  usePullDownRefresh(() => {
    void refreshRuns();
  });

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

  function getRunImageUrl(run?: ToolRun | null): string | undefined {
    return run?.outputImages?.find((image) => Boolean(image.url))?.url;
  }

  function isShareReady(run: ToolRun): boolean {
    return run.status === 'succeeded' && Boolean(
      getRunImageUrl(run) || run.summary || run.outputText,
    );
  }

  function getShareTitle(run?: ToolRun | null): string {
    return run?.title || `${activeTool?.name ?? 'AI工具'}生成结果`;
  }

  function getSharePath(run?: ToolRun | null): string {
    if (!run) {
      return `/pages/tool-history/index?tool=${encodeURIComponent(toolId)}`;
    }
    return `/pages/tool-detail/index?tool=${encodeURIComponent(run.toolId)}&runId=${encodeURIComponent(run.runId)}`;
  }

  function getShareAppMessage(run?: ToolRun | null): Taro.ShareAppMessageReturn {
    return {
      title: getShareTitle(run),
      path: getSharePath(run),
      imageUrl: getRunImageUrl(run),
    };
  }

  function getShareTimeline(run?: ToolRun | null): Taro.ShareTimelineReturnObject {
    return {
      title: getShareTitle(run),
      query: run
        ? `tool=${encodeURIComponent(run.toolId)}&runId=${encodeURIComponent(run.runId)}`
        : `tool=${encodeURIComponent(toolId)}`,
      imageUrl: getRunImageUrl(run),
    };
  }

  async function loadRuns(nextToolId = toolId, showLoading = true): Promise<void> {
    if (showLoading) {
      setLoading(true);
    }
    try {
      const result = await callCloudFunction<ListAiToolRunsResult>('list-ai-tool-runs', {
        toolId: nextToolId,
        limit: 5,
      });
      setRuns(result.runs);
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message : '历史记录刷新失败',
        icon: 'none',
      });
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }

  async function refreshRuns(): Promise<void> {
    try {
      await loadRuns(toolId, false);
    } finally {
      Taro.stopPullDownRefresh();
    }
  }

  function previewImage(run: ToolRun, imageUrl: string): void {
    const urls = run.outputImages?.map((image) => image.url).filter((item): item is string => Boolean(item)) ?? [];
    if (!imageUrl || urls.length === 0) {
      return;
    }
    void Taro.previewImage({ current: imageUrl, urls });
  }

  function openSharePanel(run: ToolRun): void {
    if (!isShareReady(run)) {
      void Taro.showToast({ title: '生成完成后可分享', icon: 'none' });
      return;
    }
    setShareRun(run);
    setSharePanelVisible(true);
    enableShareMenu();
  }

  function closeSharePanel(): void {
    setSharePanelVisible(false);
  }

  function showTimelineGuide(): void {
    setSharePanelVisible(false);
    enableShareMenu();
    void Taro.showToast({
      title: '请点击右上角分享到朋友圈',
      icon: 'none',
    });
  }

  return (
    <View className='page'>
      <AppTransparentHeader title='生成历史' />
      <View className='tools-page'>
        <View className='saas-shell tool-history-shell'>
          <View className='tool-history-hero'>
            <Text className='tool-history-hero__label'>AI工具历史</Text>
            <Text className='tool-history-hero__title'>{activeTool?.name ?? 'AI工具'}</Text>
            <Text className='tool-history-hero__desc'>仅展示当前工具下你的生成记录</Text>
          </View>

          {loading ? (
            <SkeletonOrderList count={3} />
          ) : runs.length === 0 ? (
            <View className='tool-history-card tool-history-card--empty'>
              <Text className='tool-history-card__title'>暂无生成记录</Text>
              <Text className='tool-history-card__summary'>完成一次生成后，结果会展示在这里。</Text>
            </View>
          ) : (
            runs.map((run) => {
              const imageUrl = getRunImageUrl(run);
              const shareReady = isShareReady(run);
              return (
                <View key={run.runId} className={`tool-history-card ${imageHistoryTool ? 'tool-history-card--image' : ''}`}>
                  <View className='tool-history-card__head'>
                    <View className='tool-history-card__copy'>
                      {!imageHistoryTool ? (
                        <Text className='tool-history-card__title'>{run.title || activeTool?.name || '生成记录'}</Text>
                      ) : null}
                      <Text className='tool-history-card__time'>{formatDateTime(run.createdAt)}</Text>
                    </View>
                    <View className={`status-pill status-pill--${getStatusClass(run.status)}`}>
                      <Text className='status-pill__dot' />
                      <Text>{STATUS_LABEL[run.status]}</Text>
                    </View>
                  </View>
                  {imageUrl ? (
                    <Image
                      className='tool-history-card__image'
                      src={imageUrl}
                      mode='widthFix'
                      onClick={(event) => {
                        event.stopPropagation();
                        previewImage(run, imageUrl);
                      }}
                    />
                  ) : (
                    <Text className='tool-history-card__summary'>
                      {imageHistoryTool
                        ? (run.status === 'processing' ? '图片生成中，请稍后查看。' : '暂无图片结果')
                        : (run.summary || run.outputText || (run.status === 'processing' ? '结果生成中，请稍后查看。' : '暂无结果内容'))}
                    </Text>
                  )}
                  {shareReady ? (
                    <View className='tool-history-card__share-entry'>
                      <Text className='tool-history-card__share-entry-text'>快分享给你的好友，回忆童年吧</Text>
                      <Button className='tool-history-card__share-entry-button' onClick={() => openSharePanel(run)}>
                        <View className='wechat-share-icon wechat-share-icon--small' />
                      </Button>
                    </View>
                  ) : null}
                </View>
              );
            })
          )}
        </View>
      </View>
      {sharePanelVisible ? (
        <View className='news-share-sheet' onClick={closeSharePanel}>
          <View className='news-share-sheet__panel' onClick={(event) => event.stopPropagation()}>
            <Text className='news-share-sheet__title'>分享结果</Text>
            <Text className='news-share-sheet__desc'>{getShareTitle(shareRun)}</Text>
            <View className='news-share-sheet__actions'>
              <Button className='news-share-sheet__action' openType='share' onClick={closeSharePanel}>
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
    </View>
  );
}
