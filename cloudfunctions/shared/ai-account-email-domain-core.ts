export const DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN = 'mraclpivot.com';

export interface AiAccountEmailDomainConfig {
  domain?: string;
  available?: boolean;
  status?: 'on' | 'off';
  sort?: number;
}

export function normalizeAiAccountEmailDomain(value?: string): string {
  return (value ?? '').trim().toLowerCase().replace(/^@+/, '');
}

export function isValidAiAccountEmailDomain(value?: string): boolean {
  const domain = normalizeAiAccountEmailDomain(value);
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(domain);
}

export function selectAvailableAiAccountEmailDomain(
  domains: AiAccountEmailDomainConfig[],
): string | null {
  const matched = domains
    .filter((item) => item.available === true && item.status !== 'off' && isValidAiAccountEmailDomain(item.domain))
    .sort((left, right) => (left.sort ?? 9999) - (right.sort ?? 9999))[0];
  return matched ? normalizeAiAccountEmailDomain(matched.domain) : null;
}

export function getAiAccountEmailSuffix(domain: string): string {
  return `@${normalizeAiAccountEmailDomain(domain) || DEFAULT_AI_ACCOUNT_EMAIL_DOMAIN}`;
}
