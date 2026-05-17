import { useState } from 'react';
import { WebView } from '@tarojs/components';
import { useLoad } from '@tarojs/taro';

export default function WebviewPage(): JSX.Element | null {
  const [src, setSrc] = useState('');

  useLoad((options) => {
    const url = typeof options.url === 'string' ? decodeURIComponent(options.url) : '';
    setSrc(url);
  });

  return src ? <WebView src={src} /> : null;
}
