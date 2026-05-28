import { app, collection, getUserById } from './db';
import type { OrderRecord, UserRecord } from './types';

type ReminderType = 'membership_opened' | 'renew_before_2d';

interface ReminderLogRecord {
  userId: string;
  membershipId?: string;
  orderNo?: string;
  productCode: string;
  remindDate: string;
  type: ReminderType;
  status: 'sent' | 'failed' | 'skipped';
  message?: string;
  createdAt: number;
}

function getDateKey(timestamp: number): string {
  const date = new Date(timestamp + 8 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp + 8 * 60 * 60 * 1000);
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

async function addReminderLog(record: ReminderLogRecord): Promise<void> {
  await collection('reminderLogs').add({ data: record });
}

async function sendTemplateMessage(
  user: UserRecord & { _id: string },
  templateId: string,
  data: {
    thing1: { value: string };
    phrase2: { value: string };
    time3: { value: string };
    thing4: { value: string };
  },
): Promise<void> {
  if (!templateId) {
    throw new Error('缺少开通成功模板：WX_MEMBER_OPENED_TEMPLATE_ID');
  }

  const openapi = (app as unknown as {
    openapi?: {
      subscribeMessage?: {
        send(payload: unknown): Promise<unknown>;
      };
    };
  }).openapi;
  if (!openapi?.subscribeMessage?.send) {
    throw new Error('当前云函数环境不支持 subscribeMessage.send');
  }

  await openapi.subscribeMessage.send({
    touser: user.openid,
    templateId,
    page: 'pages/member/index',
    data,
  });
}

export async function sendMembershipOpenedReminder(
  order: OrderRecord & { _id: string },
  options: {
    endAt: number;
    createdAt?: number;
  },
): Promise<void> {
  const createdAt = options.createdAt ?? Date.now();
  const user = await getUserById(order.userId);
  const baseLog = {
    userId: order.userId,
    orderNo: order.orderNo,
    productCode: order.productCode,
    remindDate: getDateKey(createdAt),
    type: 'membership_opened' as const,
    createdAt,
  };

  if (!user?.openid || !user.subscribeMsgAuth) {
    await addReminderLog({
      ...baseLog,
      status: 'skipped',
      message: !user?.openid ? '用户缺少 openid' : '用户未授权订阅消息',
    });
    return;
  }

  try {
    await sendTemplateMessage(user, process.env.WX_MEMBER_OPENED_TEMPLATE_ID || '', {
      thing1: { value: order.planName || order.productName || 'Open AI 资讯会员' },
      phrase2: { value: '月度' },
      time3: { value: formatTime(options.endAt) },
      thing4: { value: '会员已开通，可进入会员中心查看权益' },
    });
    await addReminderLog({
      ...baseLog,
      status: 'sent',
    });
  } catch (error) {
    await addReminderLog({
      ...baseLog,
      status: 'failed',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
