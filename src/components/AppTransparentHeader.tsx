import { useMemo } from 'react';
import { Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';

interface Props {
  title: string;
  showBack?: boolean;
  onBack?: () => void;
}

interface HeaderMetrics {
  statusBarHeight: number;
  navBarHeight: number;
  sideWidth: number;
  totalHeight: number;
}

function getHeaderMetrics(): HeaderMetrics {
  const systemInfo = Taro.getSystemInfoSync();
  const statusBarHeight = systemInfo.statusBarHeight ?? 20;

  try {
    const menuButton = Taro.getMenuButtonBoundingClientRect();
    const navBarHeight = Math.max(menuButton.height + (menuButton.top - statusBarHeight) * 2, 44);
    const sideWidth = Math.max(menuButton.width, 88);
    return {
      statusBarHeight,
      navBarHeight,
      sideWidth,
      totalHeight: statusBarHeight + navBarHeight + 12,
    };
  } catch {
    const navBarHeight = 44;
    const sideWidth = 88;
    return {
      statusBarHeight,
      navBarHeight,
      sideWidth,
      totalHeight: statusBarHeight + navBarHeight + 12,
    };
  }
}

export function AppTransparentHeader({ title, showBack = true, onBack }: Props): JSX.Element {
  const metrics = useMemo(() => getHeaderMetrics(), []);

  function handleBack(): void {
    if (onBack) {
      onBack();
      return;
    }

    const pages = Taro.getCurrentPages();
    if (pages.length > 1) {
      void Taro.navigateBack();
      return;
    }

    void Taro.switchTab({ url: '/pages/news/index' });
  }

  return (
    <View className='app-nav-wrap'>
      <View className='app-nav-gradient' />
      <View className='app-nav' style={{ paddingTop: `${metrics.statusBarHeight}px`, minHeight: `${metrics.totalHeight}px` }}>
        <View className='app-nav__inner' style={{ height: `${metrics.navBarHeight}px` }}>
        <View className='app-nav__side' style={{ width: `${metrics.sideWidth}px` }}>
          {showBack ? (
            <View className='app-nav__back' onClick={handleBack}>
              <Text className='app-nav__back-icon'>‹</Text>
            </View>
          ) : null}
        </View>
        <Text className='app-nav__title'>{title}</Text>
        <View className='app-nav__side' style={{ width: `${metrics.sideWidth}px` }} />
        </View>
      </View>
    </View>
  );
}
