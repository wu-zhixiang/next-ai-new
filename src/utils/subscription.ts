import Taro from '@tarojs/taro';
import { callCloudFunction } from '@/services/api';

declare const RENEW_REMINDER_TEMPLATE_ID: string;
declare const MEMBER_OPENED_TEMPLATE_ID: string;
declare const NEWS_REMINDER_TEMPLATE_ID: string;

const DEFAULT_NEWS_REMINDER_TEMPLATE_ID = 'm7Cb5rMgtJtFdyVn3YvR671tWZwyK87qe6qKr7KPZrQ';

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
      const accepted = templateIds.some((templateId) => result[templateId] === 'accept');
      await callCloudFunction<{ success: true }>('save-subscribe-auth', { accepted });
      Taro.showToast({ title: accepted ? '提醒已开启' : '未开启提醒', icon: accepted ? 'success' : 'none' });
      return accepted;
    } catch (error) {
      Taro.showToast({
        title: error instanceof Error ? error.message.slice(0, 18) : '订阅授权失败',
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
  const result = await requestSubscribeMessage({
    tmplIds: [newsReminderTemplateId],
  });
  const accepted = result[newsReminderTemplateId] === 'accept';
  await callCloudFunction<{ success: true }>('save-subscribe-auth', {
    accepted,
    scene: 'news',
  });
  Taro.showToast({
    title: accepted ? '资讯提醒已开启' : '未开启资讯提醒',
    icon: accepted ? 'success' : 'none',
  });
  return accepted;
}
