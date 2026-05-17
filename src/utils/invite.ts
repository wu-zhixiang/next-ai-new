import Taro from '@tarojs/taro';

const PENDING_INVITE_CODE_KEY = 'gpt_pay_pending_invite_code';

interface LaunchLikeOptions {
  query?: Record<string, unknown>;
}

function normalizeInviteCode(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

export function getStoredInviteCode(): string {
  return normalizeInviteCode(Taro.getStorageSync(PENDING_INVITE_CODE_KEY));
}

export function storeInviteCode(inviteCode: string): void {
  const normalized = normalizeInviteCode(inviteCode);
  if (!normalized) return;
  Taro.setStorageSync(PENDING_INVITE_CODE_KEY, normalized);
}

export function clearStoredInviteCode(): void {
  Taro.removeStorageSync(PENDING_INVITE_CODE_KEY);
}

export function resolveInviteCode(params?: Record<string, unknown>, options?: LaunchLikeOptions): string {
  const fromParams = normalizeInviteCode(params?.inviteCode);
  if (fromParams) {
    storeInviteCode(fromParams);
    return fromParams;
  }

  const fromOptions = normalizeInviteCode(options?.query?.inviteCode);
  if (fromOptions) {
    storeInviteCode(fromOptions);
    return fromOptions;
  }

  const fromEnterOptions = normalizeInviteCode(Taro.getEnterOptionsSync?.().query?.inviteCode);
  if (fromEnterOptions) {
    storeInviteCode(fromEnterOptions);
    return fromEnterOptions;
  }

  const fromLaunchOptions = normalizeInviteCode(Taro.getLaunchOptionsSync?.().query?.inviteCode);
  if (fromLaunchOptions) {
    storeInviteCode(fromLaunchOptions);
    return fromLaunchOptions;
  }

  return getStoredInviteCode();
}
