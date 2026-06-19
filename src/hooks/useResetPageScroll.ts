import { useState } from 'react';
import Taro, { useDidShow } from '@tarojs/taro';

interface ResetPageScrollResult {
  scrollTop: number;
}

export function useResetPageScroll(): ResetPageScrollResult {
  const [scrollTop, setScrollTop] = useState(0);

  useDidShow(() => {
    setScrollTop(0.1);
    Taro.nextTick(() => {
      setScrollTop(0);
    });
    void Taro.pageScrollTo({
      scrollTop: 0,
      duration: 0,
    }).catch(() => {
      // 使用内部 ScrollView 的页面由 scrollTop 属性完成复位。
    });
  });

  return {
    scrollTop,
  };
}
