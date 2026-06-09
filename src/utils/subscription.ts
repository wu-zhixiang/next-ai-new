import Taro from '@tarojs/taro';
import { callCloudFunction } from '@/services/api';

declare const RENEW_REMINDER_TEMPLATE_ID: string;
declare const MEMBER_OPENED_TEMPLATE_ID: string;
declare const NEWS_REMINDER_TEMPLATE_ID: string;

const DEFAULT_NEWS_REMINDER_TEMPLATE_ID = 'm7Cb5rMgtJtFdyVn3YvR671tWZwyK87qe6qKr7KPZrQ';

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
  const text = message.trim() || fallback;
  return text.length > 28 ? `${text.slice(0, 25)}...` : text;
}

function getReminderTemplateIds(): string[] {
  const memberOpenedTemplateId = typeof MEMBER_OPENED_TEMPLATE_ID === 'string' ? MEMBER_OPENED_TEMPLATE_ID : '';
  const renewReminderTemplateId = typeof RENEW_REMINDER_TEMPLATE_ID === 'string' ? RENEW_REMINDER_TEMPLATE_ID : '';
  return [memberOpenedTemplateId, renewReminderTemplateId].filter(Boolean);
}

export async function enableReminderSubscription(options: { source?: 'manual' | 'afterPay' } = {}): Promise<boolean> {
  const templateIds = getReminderTemplateIds();
  if (templateIds.length > 0 && typeof Taro.requestSubscribeMessage === 'function') {
    const requestSubscribeMessage = Taro.requestSubscribeMessage as unknown as (payload: {
      tmplIds: string[];
    }) => Promise<Record<string, string>>;
    try {
      const result = await requestSubscribeMessage({
        tmplIds: templateIds,
      });
      console.info('member.reminder.subscribe.result', {
        source: options.source ?? 'manual',
        templateIds,
        result,
      });
      const accepted = templateIds.some((templateId) => result[templateId] === 'accept');
      try {
        await callCloudFunction<{ success: true }>('save-subscribe-auth', { accepted });
      } catch (error) {
        console.warn('member.reminder.subscribe.save.failed', {
          source: options.source ?? 'manual',
          accepted,
          message: getErrorMessage(error),
        });
        Taro.showToast({ title: '订阅状态保存失败', icon: 'none' });
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
      });
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

  await callCloudFunction<{ success: true }>('save-subscribe-auth', { accepted: true });
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

  await callCloudFunction<{ success: true }>('save-subscribe-auth', { accepted: false });
  Taro.showToast({ title: '提醒已关闭', icon: 'success' });
  return true;
}

export async function enableNewsReminderSubscription(): Promise<boolean> {
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
      Taro.showToast({ title: '资讯订阅保存失败', icon: 'none' });
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
    });
    return false;
  }
}
