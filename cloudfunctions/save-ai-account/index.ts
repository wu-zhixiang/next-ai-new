import { collection, getUserByOpenId } from '../shared/db';
import { ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

interface Event {
  accountName?: string;
  email?: string;
  password?: string;
}

function normalizeEmail(event: Event): string {
  const raw = (event.accountName ?? event.email ?? '').trim().toLowerCase();
  return raw;
}

function assertValidEmail(email: string): void {
  if (!email) {
    throw new Error('请输入账号邮箱');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('请输入正确的邮箱账号');
  }
}

export async function main(event: Event) {
  const email = normalizeEmail(event);
  assertValidEmail(email);

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
      aiAccountPasswordEncrypted: '',
      updatedAt: now,
    },
  });

  return ok({
    aiAccountRegistered: true,
    aiAccountEmail: email,
  });
}
