import { useState } from 'react';
import { Button, Image, RichText, Text, View } from '@tarojs/components';
import Taro, { useLoad, useShareAppMessage, useShareTimeline } from '@tarojs/taro';
import { SaasPageFrame } from '@/components/SaasPageFrame';
import { callCloudFunction } from '@/services/api';
import type { AiNewsDetailView } from '@/types';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineMarkdown(value: string): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color:#31685c;text-decoration:underline;font-weight:700;">$1</a>');
}

function markdownToHtml(markdown: string): string {
  const blocks: string[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let listItems: string[] = [];
  let paragraph: string[] = [];

  function flushParagraph(): void {
    if (paragraph.length > 0) {
      blocks.push(`<p style="margin:0 0 18px;color:#1f2933;font-size:16px;line-height:1.82;">${inlineMarkdown(paragraph.join(' '))}</p>`);
      paragraph = [];
    }
  }

  function flushList(): void {
    if (listItems.length > 0) {
      blocks.push(`<ul style="margin:0 0 20px 18px;padding:0;color:#1f2933;font-size:16px;line-height:1.82;">${listItems.map((item) => `<li style="margin:0 0 8px;">${inlineMarkdown(item)}</li>`).join('')}</ul>`);
      listItems = [];
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    const imageMatched = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imageMatched) {
      flushParagraph();
      flushList();
      blocks.push(`<img alt="${escapeHtml(imageMatched[1])}" src="${escapeHtml(imageMatched[2])}" style="display:block;width:100%;max-width:100%;margin:22px 0;border-radius:14px;" />`);
      continue;
    }

    if (line.startsWith('### ')) {
      flushParagraph();
      flushList();
      blocks.push(`<h3 style="margin:28px 0 12px;color:#111827;font-size:17px;line-height:1.5;font-weight:800;">${inlineMarkdown(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      blocks.push(`<h2 style="margin:34px 0 14px;color:#111827;font-size:19px;line-height:1.45;font-weight:900;">${inlineMarkdown(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      flushParagraph();
      flushList();
      blocks.push(`<h2 style="margin:34px 0 14px;color:#111827;font-size:19px;line-height:1.45;font-weight:900;">${inlineMarkdown(line.slice(2))}</h2>`);
      continue;
    }
    if (line.startsWith('> ')) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote style="margin:20px 0;padding:14px 16px;border-left:4px solid #31685c;border-radius:10px;background:#eef8f5;color:#40524c;font-size:15px;line-height:1.75;">${inlineMarkdown(line.slice(2))}</blockquote>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      flushParagraph();
      listItems.push(line.replace(/^[-*]\s+/, ''));
      continue;
    }

    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks.join('');
}

function formatDateTime(value?: number): string {
  if (!value) return '';
  return new Date(value).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

interface MarkdownLink {
  title: string;
  url: string;
}

function extractMarkdownLinks(markdown: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const seen = new Set<string>();
  const markdownLinkPattern = /(^|[^!])\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  const rawUrlPattern = /(^|[\s(])((https?:\/\/[^\s)]+))/g;
  let matched: RegExpExecArray | null;

  while ((matched = markdownLinkPattern.exec(markdown)) !== null) {
    const title = matched[2].trim();
    const url = matched[3].trim();
    if (!seen.has(url)) {
      links.push({ title: title || url, url });
      seen.add(url);
    }
  }

  while ((matched = rawUrlPattern.exec(markdown)) !== null) {
    const url = matched[2].trim();
    if (!seen.has(url)) {
      links.push({ title: url, url });
      seen.add(url);
    }
  }

  return links;
}

export default function NewsDetailPage(): JSX.Element {
  const [detail, setDetail] = useState<AiNewsDetailView | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharePanelVisible, setSharePanelVisible] = useState(false);
  const [isDirectEntry, setIsDirectEntry] = useState(false);

  useLoad((options) => {
    enableShareMenu();
    setIsDirectEntry(Taro.getCurrentPages().length <= 1);
    const id = typeof options.id === 'string' ? options.id : '';
    void loadDetail(id);
  });

  useShareAppMessage(() => getShareAppMessage());

  useShareTimeline(() => getShareTimeline());

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

  function getShareAppMessage() {
    if (!detail) {
      return {
        title: 'AIO AI资讯',
        path: '/pages/news/index',
      };
    }
    return {
      title: detail.title,
      path: `/pages/news-detail/index?id=${encodeURIComponent(detail.id)}`,
    };
  }

  function getShareTimeline() {
    if (!detail) {
      return {
        title: 'AIO AI资讯',
        query: '',
      };
    }
    return {
      title: detail.title,
      query: `id=${encodeURIComponent(detail.id)}`,
    };
  }

  async function loadDetail(id: string): Promise<void> {
    if (!id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await callCloudFunction<AiNewsDetailView>('get-ai-news-detail', { id });
      setDetail(result);
    } catch (error) {
      Taro.showToast({ title: error instanceof Error ? error.message : '资讯加载失败', icon: 'none' });
    } finally {
      setLoading(false);
    }
  }

  async function copySourceUrl(): Promise<void> {
    if (!detail?.sourceUrl) return;
    await Taro.setClipboardData({ data: detail.sourceUrl });
  }

  async function copyMarkdownLink(url: string): Promise<void> {
    await Taro.setClipboardData({ data: url });
  }

  function previewCover(): void {
    if (!detail?.coverFileId) return;
    void Taro.previewImage({
      current: detail.coverFileId,
      urls: [detail.coverFileId],
    });
  }

  function openSharePanel(): void {
    setSharePanelVisible(true);
    enableShareMenu();
  }

  function closeSharePanel(): void {
    setSharePanelVisible(false);
  }

  function showTimelineGuide(): void {
    setSharePanelVisible(false);
    enableShareMenu();
    Taro.showToast({
      title: '请点击右上角分享到朋友圈',
      icon: 'none',
    });
  }

  function goNewsHome(): void {
    void Taro.switchTab({ url: '/pages/news/index' });
  }

  function goBack(): void {
    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      void Taro.navigateBack();
      return;
    }
    goNewsHome();
  }

  const markdownLinks = detail ? extractMarkdownLinks(detail.contentMarkdown) : [];

  return (
    <SaasPageFrame
      title='AI资讯'
      className='news-detail-frame'
      onBack={goBack}
      rightAction={isDirectEntry ? (
        <View className='news-detail-home-action' onClick={goNewsHome}>
          <Text className='news-detail-home-action__roof' />
          <Text className='news-detail-home-action__body' />
        </View>
      ) : null}
    >
      <View className='news-detail-page'>
        {loading ? (
          <View className='news-detail-empty'>
            <Text>正在加载文章</Text>
          </View>
        ) : null}
        {!loading && !detail ? (
          <View className='news-detail-empty'>
            <Text>资讯不存在或已下架</Text>
          </View>
        ) : null}
        {detail ? (
          <View className='news-detail-article'>
            {detail.coverFileId ? (
              <Image className='news-detail-article__cover' src={detail.coverFileId} mode='widthFix' onClick={previewCover} />
            ) : null}
            <Text className='news-detail-article__title'>{detail.title}</Text>
            <View className='news-detail-article__meta'>
              <Text>{detail.sourceName}{detail.authorName ? ` / ${detail.authorName}` : ''}</Text>
              <Text>{formatDateTime(detail.publishedAt)}</Text>
              <View className='news-detail-share-trigger' onClick={openSharePanel}>
                <View className='wechat-share-icon wechat-share-icon--small' />
                <Text>分享</Text>
              </View>
            </View>
            <View className='news-detail-article__summary'>
              <Text>{detail.summary}</Text>
            </View>
            <RichText className='news-detail-richtext' nodes={markdownToHtml(detail.contentMarkdown)} />
            {markdownLinks.length > 0 ? (
              <View className='news-detail-links'>
                <Text className='news-detail-links__title'>文中链接</Text>
                {markdownLinks.map((link) => (
                  <View className='news-detail-link' key={link.url} onClick={() => void copyMarkdownLink(link.url)}>
                    <Text className='news-detail-link__text'>{link.title}</Text>
                    <Text className='news-detail-link__hint'>复制</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {detail.sourceUrl ? (
              <View className='news-detail-source' onClick={() => void copySourceUrl()}>
                <Text className='news-detail-source__label'>原文来源</Text>
                <Text className='news-detail-source__url'>{detail.sourceUrl}</Text>
                <Text className='news-detail-source__hint'>点击复制链接</Text>
              </View>
            ) : null}
          </View>
        ) : null}
      </View>

      {!loading && detail ? (
        <Button className='news-detail-floating-share' openType='share'>
          <View className='wechat-share-icon news-detail-floating-share__icon' />
        </Button>
      ) : null}

      {sharePanelVisible ? (
        <View className='news-share-sheet' onClick={closeSharePanel}>
          <View className='news-share-sheet__panel' onClick={(event) => event.stopPropagation()}>
            <Text className='news-share-sheet__title'>分享资讯</Text>
            <Text className='news-share-sheet__desc'>{detail?.title || 'AIO AI资讯'}</Text>
            <View className='news-share-sheet__actions'>
              <Button className='news-share-sheet__action' openType='share'>
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
    </SaasPageFrame>
  );
}
