import Taro from '@tarojs/taro';
import { callCloudFunction } from '@/services/api';

export const AUTH_CACHE_KEY = 'gpt_pay_user_info';

export interface LoginResult {
  userId: string;
  openid?: string;
  openId?: string;
  mobileBound?: boolean;
  nickname?: string;
  avatarUrl?: string;
  inviterUserId?: string;
  inviteCode?: string;
  pointsBalance?: number;
  aiAccountRegistered?: boolean;
  profileAuthed?: boolean;
}

export type CachedUserInfo = LoginResult;

interface LoginPayload extends Partial<LoginResult> {
  source?: string;
}

export function getCachedUserInfo(): CachedUserInfo | null {
  const raw = Taro.getStorageSync(AUTH_CACHE_KEY) as string;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CachedUserInfo;
  } catch {
    return null;
  }
}

export function saveCachedUserInfo(info: CachedUserInfo): void {
  Taro.setStorageSync(AUTH_CACHE_KEY, JSON.stringify(info));
}

export function normalizeLoginResult(result: LoginResult, fallback?: Partial<CachedUserInfo>): CachedUserInfo {
  return {
    ...fallback,
    ...result,
    openid: result.openid ?? result.openId ?? fallback?.openid ?? fallback?.openId,
    openId: result.openId ?? result.openid ?? fallback?.openId ?? fallback?.openid,
    profileAuthed: Boolean(result.nickname || result.avatarUrl || fallback?.profileAuthed),
  };
}

export async function loginSilently(payload: LoginPayload = {}): Promise<CachedUserInfo> {
  const cached = getCachedUserInfo();
  const nickname = payload.nickname?.trim() || cached?.nickname;
  const avatarUrl = payload.avatarUrl?.trim() || cached?.avatarUrl;
  const result = await callCloudFunction<LoginResult>('user-login', {
    nickname,
    avatarUrl,
    inviteCode: payload.inviteCode,
    source: payload.inviteCode ? 'share' : payload.source ?? 'silent',
  });
  const nextInfo = normalizeLoginResult(result, cached ?? payload);
  saveCachedUserInfo(nextInfo);
  return nextInfo;
}
