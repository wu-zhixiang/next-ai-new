import Taro from '@tarojs/taro';
import { callCloudFunction } from '@/services/api';
import { ensurePrivacyAuthorization } from '@/utils/privacyAuthorization';

declare const RENEW_REMINDER_TEMPLATE_ID: string;
declare const MEMBER_OPENED_TEMPLATE_ID: string;
declare const NEWS_REMINDER_TEMPLATE_ID: string;

const DEFAULT_NEWS_REMINDER_TEMPLATE_ID = 'm7Cb5rMgtJtFdyVn3YvR671tWZwyK87qe6qKr7KPZrQ';
const DEFAULT_RENEW_REMINDER_TEMPLATE_ID = 'Bjcl8gXqgcsL3U0KKamcHCJmUcNhUvUeFXtI9FyLfjM';
const DEFAULT_MEMBER_OPENED_TEMPLATE_ID = '4rQrIilbMi6SumpNJK7rkW3YUSmsQosoOMDrvhHttwU';
const AUTH_CACHE_KEY = 'gpt_pay_user_info';

interface SubscribeLoginResult {
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'errMsg' in error) {
    const errMsg = (error as { errMsg?: unknown }).errMsg;
    return typeof errMsg === 'string' ? errMsg : String(errMsg ?? '');
  }
  return String(error ?? '');
}

function getToastMessage(message: string, fallback: string): string {
  return message.trim() || fallback;
}

function isNoTemplateDataError(message: string): boolean {
  return message.toLowerCase().includes('no template data');
}

async function showFullError(title: string, content: string): Promise<void> {
  await Taro.showModal({
    title,
    content,
    showCancel: false,
    confirmText: '知道了',
  });
}

function getReminderTemplateIds(): string[] {
  const memberOpenedTemplateId = typeof MEMBER_OPENED_TEMPLATE_ID === 'string' && MEMBER_OPENED_TEMPLATE_ID
    ? MEMBER_OPENED_TEMPLATE_ID
    : DEFAULT_MEMBER_OPENED_TEMPLATE_ID;
  const renewReminderTemplateId = typeof RENEW_REMINDER_TEMPLATE_ID === 'string' && RENEW_REMINDER_TEMPLATE_ID
    ? RENEW_REMINDER_TEMPLATE_ID
    : DEFAULT_RENEW_REMINDER_TEMPLATE_ID;
  return [memberOpenedTemplateId, renewReminderTemplateId].filter(Boolean);
}

async function requestMemberSubscribeMessages(templateIds: string[]): Promise<Record<string, string>> {
  const requestSubscribeMessage = Taro.requestSubscribeMessage as unknown as (payload: {
    tmplIds: string[];
  }) => Promise<Record<string, string>>;

  return requestSubscribeMessage({ tmplIds: templateIds });
}

function shouldRetryAfterLogin(message: string): boolean {
  return message.includes('登录态') || message.includes('用户未登录') || message.toLowerCase().includes('openid');
}

async function refreshLoginState(): Promise<void> {
  const cachedRaw = Taro.getStorageSync(AUTH_CACHE_KEY) as string;
  let cachedInfo: Partial<SubscribeLoginResult> = {};
  if (cachedRaw) {
    try {
      cachedInfo = JSON.parse(cachedRaw) as Partial<SubscribeLoginResult>;
    } catch {
      cachedInfo = {};
    }
  }

  const result = await callCloudFunction<SubscribeLoginResult>('user-login', {
    nickname: cachedInfo.nickname,
    avatarUrl: cachedInfo.avatarUrl,
    source: 'subscribe-auth-retry',
  });
  const nextInfo: SubscribeLoginResult = {
    ...cachedInfo,
    ...result,
    openid: result.openid ?? result.openId ?? cachedInfo.openid ?? cachedInfo.openId,
    openId: result.openId ?? result.openid ?? cachedInfo.openId ?? cachedInfo.openid,
    profileAuthed: Boolean(result.nickname || result.avatarUrl || cachedInfo.profileAuthed),
  };
  Taro.setStorageSync(AUTH_CACHE_KEY, JSON.stringify(nextInfo));
}

async function saveMemberSubscribeAuth(accepted: boolean): Promise<void> {
  const payload = {
    accepted,
    scene: 'member',
  };
  try {
    await callCloudFunction<{ success: true }>('save-subscribe-auth', payload);
  } catch (error) {
    const message = getErrorMessage(error);
    if (!shouldRetryAfterLogin(message)) {
      throw error;
    }
    await refreshLoginState();
    await callCloudFunction<{ success: true }>('save-subscribe-auth', payload);
  }
}

export async function enableReminderSubscription(options: { source?: 'manual' | 'afterPay' } = {}): Promise<boolean> {
  if (!await ensurePrivacyAuthorization()) {
    return false;
  }

  const templateIds = getReminderTemplateIds();
  if (templateIds.length > 0 && typeof Taro.requestSubscribeMessage === 'function') {
    try {
      const result = await requestMemberSubscribeMessages(templateIds);
      console.info('member.reminder.subscribe.result', {
        source: options.source ?? 'manual',
        templateIds,
        result,
      });
      const accepted = templateIds.some((templateId) => result[templateId] === 'accept');
      try {
        await saveMemberSubscribeAuth(Boolean(accepted));
      } catch (error) {
        console.warn('member.reminder.subscribe.save.failed', {
          source: options.source ?? 'manual',
          accepted,
          message: getErrorMessage(error),
        });
        Taro.showToast({
          title: getToastMessage(getErrorMessage(error), '订阅状态保存失败'),
          icon: 'none',
          duration: 4000,
        });
        return false;
      }
      Taro.showToast({ title: accepted ? '提醒已开启' : '未开启提醒', icon: accepted ? 'success' : 'none' });
      return accepted;
    } catch (error) {
      const message = getErrorMessage(error);
      console.warn('member.reminder.subscribe.request.failed', {
        source: options.source ?? 'manual',
        templateIds,
        message,
      });
      Taro.showToast({
        title: getToastMessage(message, '订阅授权失败'),
        icon: 'none',
        duration: 4000,
      });
      if (isNoTemplateDataError(message) || message.includes('订阅模板不可用')) {
        void showFullError('订阅模板不可用', message);
      }
      return false;
    }
  }

  if (templateIds.length === 0) {
    Taro.showToast({ title: '消息提醒模板未配置', icon: 'none' });
    return false;
  }

  const result = await Taro.showModal({
    title: options.source === 'afterPay' ? '开启消息提醒' : '开启到期提醒',
    content: options.source === 'afterPay'
      ? '开通完成后通知你，会员到期前 2 天提醒你手动续费。'
      : '会员到期前 2 天提醒你手动续费，避免服务中断。',
    confirmText: '开启提醒',
    cancelText: '暂不开启',
  });

  if (!result.confirm) {
    return false;
  }

  await saveMemberSubscribeAuth(true);
  Taro.showToast({ title: '提醒已开启', icon: 'success' });
  return true;
}

export async function disableReminderSubscription(): Promise<boolean> {
  const result = await Taro.showModal({
    title: '关闭到期提醒',
    content: '关闭后，会员到期前 2 天将不再提醒你手动续费。',
    confirmText: '关闭提醒',
    cancelText: '保留',
  });

  if (!result.confirm) {
    return false;
  }

  await saveMemberSubscribeAuth(false);
  Taro.showToast({ title: '提醒已关闭', icon: 'success' });
  return true;
}

export async function enableNewsReminderSubscription(): Promise<boolean> {
  if (!await ensurePrivacyAuthorization()) {
    return false;
  }

  const newsReminderTemplateId = typeof NEWS_REMINDER_TEMPLATE_ID === 'string' && NEWS_REMINDER_TEMPLATE_ID
    ? NEWS_REMINDER_TEMPLATE_ID
    : DEFAULT_NEWS_REMINDER_TEMPLATE_ID;

  if (!newsReminderTemplateId) {
    Taro.showToast({ title: '资讯提醒模板未配置', icon: 'none' });
    return false;
  }

  if (typeof Taro.requestSubscribeMessage !== 'function') {
    Taro.showToast({ title: '当前微信版本不支持订阅提醒', icon: 'none' });
    return false;
  }

  const requestSubscribeMessage = Taro.requestSubscribeMessage as unknown as (payload: {
    tmplIds: string[];
  }) => Promise<Record<string, string>>;
  try {
    const result = await requestSubscribeMessage({
      tmplIds: [newsReminderTemplateId],
    });
    console.info('news.reminder.subscribe.result', {
      templateId: newsReminderTemplateId,
      result,
    });
    const accepted = result[newsReminderTemplateId] === 'accept';
    try {
      await callCloudFunction<{ success: true }>('save-subscribe-auth', {
        accepted,
        scene: 'news',
      });
    } catch (error) {
      console.warn('news.reminder.subscribe.save.failed', {
        accepted,
        templateId: newsReminderTemplateId,
        message: getErrorMessage(error),
      });
      Taro.showToast({
        title: getToastMessage(getErrorMessage(error), '资讯订阅保存失败'),
        icon: 'none',
        duration: 4000,
      });
      return false;
    }
    Taro.showToast({
      title: accepted ? '资讯提醒已开启' : '未开启资讯提醒',
      icon: accepted ? 'success' : 'none',
    });
    return accepted;
  } catch (error) {
    const message = getErrorMessage(error);
    console.warn('news.reminder.subscribe.request.failed', {
      templateId: newsReminderTemplateId,
      message,
    });
    Taro.showToast({
      title: getToastMessage(message, '资讯订阅授权失败'),
      icon: 'none',
      duration: 4000,
    });
    return false;
  }
}
