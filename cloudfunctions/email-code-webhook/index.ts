import { collection, ensureCollection, getUserByAiAccountEmail } from '../shared/db';
import type { AppStoreEmailVerificationCodeRecord, EmailVerificationCodeRecord } from '../shared/types';
import { ok } from '../shared/utils';

interface Event {
  body?: string;
  to?: string;
  from?: string;
  subject?: string;
  code?: string;
  candidates?: string[];
  text?: string;
  html?: string;
  content?: string;
  receivedAt?: number;
  headers?: Record<string, string>;
}

type EmailCodePayload = Required<Pick<Event, 'to' | 'from' | 'subject' | 'code'>> & {
  candidates?: string[];
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
  const appleEmail = isAppleEmail(payload.from, payload.subject);
  const code = appleEmail ? normalizeAppleCode(payload) : normalizeCode(payload.code, payload.subject, payload.text, payload.html, payload.content);
  if (!email.endsWith(EMAIL_DOMAIN)) {
    throw new Error('邮箱域名不合法');
  }
  if (!code) {
    throw new Error('验证码格式不合法');
  }

  const receivedAt = normalizeReceivedAt(payload.receivedAt);
  if (appleEmail) {
    const record: AppStoreEmailVerificationCodeRecord = {
      email,
      code,
      from: payload.from ?? '',
      subject: payload.subject ?? '',
      receivedAt,
      expiresAt: receivedAt + CODE_TTL_MS,
      usedAt: null,
      createdAt: Date.now(),
    };
    await ensureCollection('appstoreEmailVerificationCodes');
    await collection('appstoreEmailVerificationCodes').add({ data: record });

    console.info(
      JSON.stringify({
        tag: 'appleEmailCode.saved',
        email,
        provider: 'apple',
        receivedAt,
      }),
    );

    return ok({ success: true });
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

function normalizeAppleCode(payload: EmailCodePayload): string {
  const keywordCode = normalizeKeywordCode(payload.subject, payload.text, payload.html, payload.content);
  if (keywordCode) {
    return keywordCode;
  }

  const firstCandidate = normalizeCandidates(payload.candidates)[0];
  if (firstCandidate) {
    return firstCandidate;
  }

  return normalizeCode(payload.code);
}

function normalizeKeywordCode(...values: Array<string | undefined>): string {
  const patterns = [
    /(?:验证码|驗證碼|临时验证码|一次性代码)[^\d]{0,120}(\d{6})/i,
    /(?:verification code|temporary code|one-time code|login code|code)[^\d]{0,120}(\d{6})/i,
    /(\d{6})[^\d]{0,120}(?:验证码|驗證碼|verification code|temporary code|one-time code|login code)/i,
  ];

  for (const value of values) {
    const text = (value ?? '').replace(/\s+/g, ' ');
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1];
      }
    }
  }

  return '';
}

function normalizeCandidates(value?: string[]): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(new Set(value.map((item) => String(item).trim()).filter((item) => /^\d{6}$/.test(item))));
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

function isAppleEmail(from?: string, subject?: string): boolean {
  const normalizedFrom = (from ?? '').toLowerCase();
  const normalizedSubject = (subject ?? '').toLowerCase();
  return normalizedFrom.includes('apple') || normalizedSubject.includes('apple');
}
