import { collection, getUserByOpenId } from '../shared/db';
import { encryptAiAccountPassword } from '../shared/ai-account';
import { ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

interface Event {
  accountName?: string;
  email?: string;
  password?: string;
}

const AI_ACCOUNT_DOMAIN = 'mraclpivot.com';

function normalizeAccountName(event: Event): string {
  const raw = (event.accountName ?? event.email ?? '').trim().toLowerCase();
  return raw.endsWith(`@${AI_ACCOUNT_DOMAIN}`)
    ? raw.slice(0, -AI_ACCOUNT_DOMAIN.length - 1)
    : raw;
}

function assertValidAccountName(accountName: string): void {
  if (!/^[a-z][a-z0-9._-]{2,31}$/.test(accountName)) {
    throw new Error('账号需为3-32位小写字母开头，可含数字、点、下划线或中划线');
  }
  if (accountName.includes('..') || accountName.startsWith('.') || accountName.endsWith('.')) {
    throw new Error('账号格式不正确，请调整点号位置');
  }
}

function assertValidPassword(password: string): void {
  if (password.length < 8 || password.length > 64) {
    throw new Error('密码需为 8-64 位');
  }
  if (/\s/.test(password)) {
    throw new Error('密码不能包含空格');
  }
  if (!/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/[0-9]/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    throw new Error('密码需包含大小写字母、数字和特殊符号');
  }
}

export async function main(event: Event) {
  const accountName = normalizeAccountName(event);
  const email = `${accountName}@${AI_ACCOUNT_DOMAIN}`;
  const password = event.password ?? '';

  assertValidAccountName(accountName);
  if (!password) {
    throw new Error('请输入账号密码');
  }
  assertValidPassword(password);

  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    throw new Error('请先登录后再注册 AI 账号');
  }

  const now = Date.now();
  await collection('users').doc(user._id).update({
    data: {
      aiAccountRegistered: true,
      aiAccountEmail: email,
      aiAccountPasswordEncrypted: encryptAiAccountPassword(password),
      updatedAt: now,
    },
  });

  return ok({
    aiAccountRegistered: true,
    aiAccountEmail: email,
  });
}
