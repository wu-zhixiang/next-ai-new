import { collection, ensureCollection } from './db';
import type { AiAccountEmailDomainRecord } from './types';
import {
  DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN,
  normalizeAiAccountEmailDomain,
  selectAvailableAiAccountEmailDomain,
} from './ai-account-email-domain-core';

export { DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN, getAiAccountEmailSuffix } from './ai-account-email-domain-core';

const MISSING_COLLECTION_MESSAGES = [
  'collection not exists',
  'DATABASE_COLLECTION_NOT_EXIST',
  'Table not exist',
  'Db or Table not exist',
];

interface CollectionListRef {
  get(): Promise<{ data: unknown[] }>;
}

export const AI_ACCOUNT_EMAIL_DOMAIN_SEED: AiAccountEmailDomainRecord[] = [
  {
    domain: DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN,
    available: true,
    status: 'on',
    sort: 1,
    note: '默认 AI 账号注册邮箱域名',
    createdAt: 1746921600000,
    updatedAt: 1746921600000,
  },
];

export async function listAiAccountEmailDomains(): Promise<Array<AiAccountEmailDomainRecord & { _id: string }>> {
  try {
    const result = await (collection('aiAccountEmailDomains') as unknown as CollectionListRef).get();
    return result.data as Array<AiAccountEmailDomainRecord & { _id: string }>;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (MISSING_COLLECTION_MESSAGES.some((item) => message.includes(item))) {
      return [];
    }
    throw error;
  }
}

export async function getAvailableAiAccountEmailDomain(): Promise<string> {
  const domains = await listAiAccountEmailDomains();
  const selected = selectAvailableAiAccountEmailDomain(domains);
  if (selected) {
    return selected;
  }
  if (domains.length === 0) {
    return DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN;
  }
  throw new Error('暂无可用邮箱域名，请联系管理员配置');
}

export async function listAllowedAiAccountEmailDomains(): Promise<string[]> {
  const domains = await listAiAccountEmailDomains();
  const normalized = domains
    .map((item) => normalizeAiAccountEmailDomain(item.domain))
    .filter(Boolean);
  return Array.from(new Set([DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN, ...normalized]));
}

export async function seedAiAccountEmailDomains(now = Date.now()): Promise<number> {
  await ensureCollection('aiAccountEmailDomains');

  for (const seed of AI_ACCOUNT_EMAIL_DOMAIN_SEED) {
    const domain = normalizeAiAccountEmailDomain(seed.domain);
    const existing = await collection('aiAccountEmailDomains').where({ domain }).limit(1).get();
    const current = existing.data[0] as (AiAccountEmailDomainRecord & { _id: string }) | undefined;
    if (current?._id) {
      continue;
    }

    await collection('aiAccountEmailDomains').add({
      data: {
        ...seed,
        domain,
        createdAt: now,
        updatedAt: now,
      },
    });
  }

  return AI_ACCOUNT_EMAIL_DOMAIN_SEED.length;
}
