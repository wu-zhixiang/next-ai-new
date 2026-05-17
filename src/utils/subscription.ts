import Taro from '@tarojs/taro';
import { callCloudFunction } from '@/services/api';

export async function enableReminderSubscription(): Promise<boolean> {
  const result = await Taro.showModal({
    title: '开启到期提醒',
    content: '当前为联调版本，先记录提醒授权状态。后续再接入真实订阅消息模板。',
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
