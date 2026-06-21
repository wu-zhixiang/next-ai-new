import Taro from '@tarojs/taro';
import { requestPrivacyAuthorization } from '@/utils/privacyAuthorizationCore';

export async function ensurePrivacyAuthorization(showDeniedToast = true): Promise<boolean> {
  if (process.env.TARO_ENV !== 'weapp') {
    return true;
  }

  const authorized = await requestPrivacyAuthorization(Taro);
  if (!authorized && showDeniedToast) {
    await Taro.showToast({
      title: '需同意隐私保护指引后继续',
      icon: 'none',
      duration: 2200,
    });
  }
  return authorized;
}

export { requestPrivacyAuthorization } from '@/utils/privacyAuthorizationCore';

export async function requirePrivacyAuthorization(): Promise<void> {
  if (!await ensurePrivacyAuthorization()) {
    throw new Error('隐私权限未授权');
  }
}
