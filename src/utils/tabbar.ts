import Taro from '@tarojs/taro';

export function hideTabBarSafely(): void {
  Taro.hideTabBar({ animation: false }).catch(() => undefined);
}

export function showTabBarSafely(): void {
  Taro.showTabBar({ animation: false }).catch(() => undefined);
}
