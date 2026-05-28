import Taro from '@tarojs/taro';
import { callCloudFunction } from '@/services/api';

declare const RENEW_REMINDER_TEMPLATE_ID: string;

export async function enableReminderSubscription(options: { source?: 'manual' | 'afterPay' } = {}): Promise<boolean> {
  if (RENEW_REMINDER_TEMPLATE_ID && typeof Taro.requestSubscribeMessage === 'function') {
    const requestSubscribeMessage = Taro.requestSubscribeMessage as unknown as (payload: {
      tmplIds: string[];
    }) => Promise<Record<string, string>>;
    const result = await requestSubscribeMessage({
      tmplIds: [RENEW_REMINDER_TEMPLATE_ID],
    });
    const accepted = result[RENEW_REMINDER_TEMPLATE_ID] === 'accept';
    await callCloudFunction<{ success: true }>('save-subscribe-auth', { accepted });
    Taro.showToast({ title: accepted ? '提醒已开启' : '未开启提醒', icon: accepted ? 'success' : 'none' });
    return accepted;
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
