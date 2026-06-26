import assert from 'node:assert/strict';
import test from 'node:test';

import { parseXStatusId, selectBestXMp4Variant, selectSmallestXMp4Variant, selectXVideoMedia } from '../cloudfunctions/shared/x-video.ts';

test('parseXStatusId extracts the post id from x.com video links', () => {
  assert.equal(
    parseXStatusId('https://x.com/johnAGI168/status/2069291154986668423/video/1'),
    '2069291154986668423',
  );
});

test('parseXStatusId rejects non-X hosts', () => {
  assert.throws(() => parseXStatusId('https://example.com/status/2069291154986668423/video/1'), /仅支持/);
});

test('selectBestXMp4Variant picks the highest bitrate mp4 variant', () => {
  const selected = selectBestXMp4Variant([
    { content_type: 'application/x-mpegURL', url: 'https://video.example/hls.m3u8' },
    { content_type: 'video/mp4', url: 'https://video.example/low.mp4', bit_rate: 256000 },
    { content_type: 'video/mp4', url: 'https://video.example/high.mp4', bit_rate: 2176000 },
  ]);

  assert.equal(selected?.url, 'https://video.example/high.mp4');
});

test('selectSmallestXMp4Variant picks the smallest mp4 variant for cloud upload', () => {
  const selected = selectSmallestXMp4Variant([
    { content_type: 'video/mp4', url: 'https://video.example/high.mp4', bit_rate: 2176000 },
    { content_type: 'application/x-mpegURL', url: 'https://video.example/hls.m3u8' },
    { content_type: 'video/mp4', url: 'https://video.example/low.mp4', bit_rate: 256000 },
  ]);

  assert.equal(selected?.url, 'https://video.example/low.mp4');
});

test('selectXVideoMedia ignores photo media and returns playable video media', () => {
  const selected = selectXVideoMedia([
    { type: 'photo', url: 'https://image.example/a.jpg' },
    {
      type: 'video',
      preview_image_url: 'https://image.example/poster.jpg',
      variants: [
        { content_type: 'video/mp4', url: 'https://video.example/video.mp4', bit_rate: 832000 },
      ],
    },
  ]);

  assert.equal(selected?.preview_image_url, 'https://image.example/poster.jpg');
});
