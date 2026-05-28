import { app, collection } from '../shared/db';
import { ok } from '../shared/utils';
import type { MembershipRecord, UserRecord } from '../shared/types';

interface Event {
  dryRun?: boolean;
  now?: number;
}

interface ReminderLogRecord {
  userId: string;
  membershipId: string;
  productCode: string;
  remindDate: string;
  type: 'renew_before_2d';
  status: 'sent' | 'failed' | 'skipped';
  message?: string;
  createdAt: number;
}

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function getDateKey(timestamp: number): string {
  const date = new Date(timestamp + 8 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function formatTime(timestamp: number): string {
  const date = new Date(timestamp + 8 * 60 * 60 * 1000);
  return date.toISOString().replace('T', ' ').slice(0, 16);
}

async function getUserById(userId: string): Promise<(UserRecord & { _id: string }) | null> {
  const result = await collection('users').doc(userId).get();
  return (result.data as (UserRecord & { _id: string }) | undefined) ?? null;
}

async function hasReminderLog(userId: string, membershipId: string, remindDate: string): Promise<boolean> {
  const result = await collection('reminderLogs')
    .where({
      userId,
      membershipId,
      remindDate,
      type: 'renew_before_2d',
    })
    .limit(1)
    .get();
  return Boolean(result.data[0]);
}

async function addReminderLog(record: ReminderLogRecord): Promise<void> {
  await collection('reminderLogs').add({ data: record });
}

async function sendSubscribeMessage(user: UserRecord & { _id: string }, membership: MembershipRecord & { _id: string }): Promise<void> {
  const templateId = process.env.WX_RENEW_REMINDER_TEMPLATE_ID;
  if (!templateId) {
    throw new Error('缺少续费提醒模板：WX_RENEW_REMINDER_TEMPLATE_ID');
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
    data: {
      thing1: { value: membership.planName || membership.productName || 'Open AI 资讯会员' },
      phrase2: { value: '月度' },
      time3: { value: formatTime(membership.endAt) },
      thing4: { value: '会员即将到期，请及时续费' },
    },
  });
}

export async function main(event: Event = {}) {
  const now = event.now ?? Date.now();
  const windowStart = now;
  const windowEnd = now + TWO_DAYS_MS;
  const remindDate = getDateKey(now);

  const result = await collection('memberships')
    .where({
      status: 'active',
    })
    .get();
  const memberships = (result.data as Array<MembershipRecord & { _id: string }>)
    .filter((membership) => membership.endAt > windowStart && membership.endAt <= windowEnd);

  const summary = {
    candidates: memberships.length,
    sent: 0,
    skipped: 0,
    failed: 0,
  };

  for (const membership of memberships) {
    const user = await getUserById(membership.userId);
    const alreadySent = await hasReminderLog(membership.userId, membership._id, remindDate);
    if (!user?.openid || !user.subscribeMsgAuth || alreadySent || membership.endAt - now > TWO_DAYS_MS + ONE_DAY_MS) {
      summary.skipped += 1;
      if (!event.dryRun && !alreadySent) {
        await addReminderLog({
          userId: membership.userId,
          membershipId: membership._id,
          productCode: membership.productCode,
          remindDate,
          type: 'renew_before_2d',
          status: 'skipped',
          message: !user?.openid ? '用户缺少 openid' : !user.subscribeMsgAuth ? '用户未授权订阅消息' : '不满足发送条件',
          createdAt: now,
        });
      }
      continue;
    }

    if (event.dryRun) {
      summary.sent += 1;
      continue;
    }

    try {
      await sendSubscribeMessage(user, membership);
      summary.sent += 1;
      await addReminderLog({
        userId: membership.userId,
        membershipId: membership._id,
        productCode: membership.productCode,
        remindDate,
        type: 'renew_before_2d',
        status: 'sent',
        createdAt: now,
      });
    } catch (error) {
      summary.failed += 1;
      await addReminderLog({
        userId: membership.userId,
        membershipId: membership._id,
        productCode: membership.productCode,
        remindDate,
        type: 'renew_before_2d',
        status: 'failed',
        message: error instanceof Error ? error.message : String(error),
        createdAt: now,
      });
    }
  }

  return ok(summary);
}
