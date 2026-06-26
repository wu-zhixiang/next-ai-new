export interface XVideoVariant {
  content_type?: string;
  url?: string;
  bit_rate?: number;
}

export interface XMediaObject {
  type?: string;
  url?: string;
  preview_image_url?: string;
  variants?: XVideoVariant[];
}

export function parseXStatusId(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('X 视频链接格式不正确');
  }

  const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
  if (hostname !== 'x.com' && hostname !== 'twitter.com') {
    throw new Error('仅支持 x.com/twitter.com 链接');
  }

  const parts = url.pathname.split('/').filter(Boolean);
  const statusIndex = parts.findIndex((part) => part === 'status' || part === 'statuses');
  const statusId = statusIndex >= 0 ? parts[statusIndex + 1] : '';
  if (!statusId || !/^\d{5,30}$/.test(statusId)) {
    throw new Error('未识别到 X 帖子 ID');
  }

  return statusId;
}

export function selectBestXMp4Variant(variants: XVideoVariant[]): XVideoVariant | null {
  const mp4Variants = variants
    .filter((variant) => (
      variant.content_type === 'video/mp4'
      && typeof variant.url === 'string'
      && /^https:\/\//.test(variant.url)
    ))
    .sort((left, right) => Number(right.bit_rate ?? 0) - Number(left.bit_rate ?? 0));

  return mp4Variants[0] ?? null;
}

export function selectSmallestXMp4Variant(variants: XVideoVariant[]): XVideoVariant | null {
  const mp4Variants = variants
    .filter((variant) => (
      variant.content_type === 'video/mp4'
      && typeof variant.url === 'string'
      && /^https:\/\//.test(variant.url)
    ))
    .sort((left, right) => Number(left.bit_rate ?? Number.MAX_SAFE_INTEGER) - Number(right.bit_rate ?? Number.MAX_SAFE_INTEGER));

  return mp4Variants[0] ?? null;
}

export function selectXVideoMedia(media: XMediaObject[]): XMediaObject | null {
  const videos = media.filter((item) => item.type === 'video' || item.type === 'animated_gif');
  return videos.find((item) => selectBestXMp4Variant(item.variants ?? [])) ?? null;
}
