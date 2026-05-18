import { collection, getUserByAiAccountEmail } from '../shared/db';
import type { EmailVerificationCodeRecord } from '../shared/types';
import { ok } from '../shared/utils';

interface Event {
  body?: string;
  to?: string;
  from?: string;
  subject?: string;
  code?: string;
  receivedAt?: number;
  headers?: Record<string, string>;
}

const CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_DOMAIN = '@mraclpivot.com';

export async function main(event: Event = {}) {
  const payload = normalizeEvent(event);
  assertWebhookSecret(event);

  const email = normalizeEmail(payload.to);
  const code = normalizeCode(payload.code);
  if (!email.endsWith(EMAIL_DOMAIN)) {
    throw new Error('邮箱域名不合法');
  }
  if (!code) {
    throw new Error('验证码格式不合法');
  }

  const user = await getUserByAiAccountEmail(email);
  if (!user) {
    console.warn(
      JSON.stringify({
        tag: 'emailCode.userMissing',
        email,
        from: payload.from,
      }),
    );
    return ok({ success: true, ignored: true, reason: 'user_missing' });
  }

  const receivedAt = typeof payload.receivedAt === 'number' ? payload.receivedAt : Date.now();
  const record: EmailVerificationCodeRecord = {
    email,
    userId: user._id,
    code,
    provider: isOpenAiEmail(payload.from) ? 'openai' : 'unknown',
    from: payload.from ?? '',
    subject: payload.subject ?? '',
    receivedAt,
    expiresAt: receivedAt + CODE_TTL_MS,
    usedAt: null,
    createdAt: Date.now(),
  };
  await collection('emailVerificationCodes').add({ data: record });

  console.info(
    JSON.stringify({
      tag: 'emailCode.saved',
      email,
      userId: user._id,
      provider: record.provider,
      receivedAt,
    }),
  );

  return ok({ success: true });
}

function normalizeEvent(event: Event): Required<Pick<Event, 'to' | 'from' | 'subject' | 'code'>> & { receivedAt?: number } {
  if (event.body) {
    try {
      return {
        ...event,
        ...JSON.parse(event.body),
      };
    } catch {
      return event as Required<Pick<Event, 'to' | 'from' | 'subject' | 'code'>> & { receivedAt?: number };
    }
  }
  return event as Required<Pick<Event, 'to' | 'from' | 'subject' | 'code'>> & { receivedAt?: number };
}

function assertWebhookSecret(event: Event): void {
  const expected = process.env.EMAIL_WEBHOOK_SECRET;
  if (!expected) {
    throw new Error('EMAIL_WEBHOOK_SECRET 未配置');
  }
  const headers = event.headers ?? {};
  const actual = headers['x-email-webhook-secret'] ?? headers['X-Email-Webhook-Secret'];
  if (actual !== expected) {
    throw new Error('Webhook secret 不合法');
  }
}

function normalizeEmail(value?: string): string {
  return (value ?? '').trim().toLowerCase();
}

function normalizeCode(value?: string): string {
  const code = (value ?? '').trim();
  return /^\d{6}$/.test(code) ? code : '';
}

function isOpenAiEmail(value?: string): boolean {
  const from = (value ?? '').toLowerCase();
  return from.includes('openai.com');
}
