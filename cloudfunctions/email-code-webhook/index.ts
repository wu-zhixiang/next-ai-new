import { collection, getUserByAiAccountEmail } from '../shared/db';
import type { EmailVerificationCodeRecord } from '../shared/types';
import { ok } from '../shared/utils';

interface Event {
  body?: string;
  to?: string;
  from?: string;
  subject?: string;
  code?: string;
  text?: string;
  html?: string;
  content?: string;
  receivedAt?: number;
  headers?: Record<string, string>;
}

type EmailCodePayload = Required<Pick<Event, 'to' | 'from' | 'subject' | 'code'>> & {
  text?: string;
  html?: string;
  content?: string;
  receivedAt?: number;
};

const CODE_TTL_MS = 10 * 60 * 1000;
const EMAIL_DOMAIN = '@mraclpivot.com';

export async function main(event: Event = {}) {
  const payload = normalizeEvent(event);
  assertWebhookSecret(event);

  const email = normalizeEmail(payload.to);
  const code = normalizeCode(payload.code, payload.subject, payload.text, payload.html, payload.content);
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

  const receivedAt = normalizeReceivedAt(payload.receivedAt);
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

function normalizeEvent(event: Event): EmailCodePayload {
  if (event.body) {
    try {
      return {
        ...event,
        ...JSON.parse(event.body),
      };
    } catch {
      return event as EmailCodePayload;
    }
  }
  return event as EmailCodePayload;
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
  const raw = (value ?? '').trim().toLowerCase();
  const matched = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i);
  return (matched?.[0] ?? raw).toLowerCase();
}

function normalizeCode(...values: Array<string | undefined>): string {
  for (const value of values) {
    const text = (value ?? '').trim();
    const directCode = text.match(/^\d{6}$/)?.[0];
    if (directCode) {
      return directCode;
    }
    const embeddedCode = text.match(/(?:^|[^\d])(\d{6})(?:[^\d]|$)/)?.[1];
    if (embeddedCode) {
      return embeddedCode;
    }
  }
  return '';
}

function normalizeReceivedAt(value?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    return Date.now();
  }
  return value < 1000000000000 ? value * 1000 : value;
}

function isOpenAiEmail(value?: string): boolean {
  const from = (value ?? '').toLowerCase();
  return from.includes('openai.com');
}
