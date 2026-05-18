import { collection, getUserByOpenId } from '../shared/db';
import type { EmailVerificationCodeRecord } from '../shared/types';
import { ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

interface Event {
  codeId?: string;
}

export async function main(event: Event = {}) {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    throw new Error('请先登录后再操作验证码');
  }
  if (!event.codeId) {
    throw new Error('缺少验证码记录');
  }

  const result = await collection('emailVerificationCodes').doc(event.codeId).get();
  const codeRecord = result.data as (EmailVerificationCodeRecord & { _id: string }) | undefined;
  if (!codeRecord || codeRecord.userId !== user._id || codeRecord.email !== user.aiAccountEmail) {
    throw new Error('验证码记录不存在');
  }

  await collection('emailVerificationCodes').doc(event.codeId).update({
    data: {
      usedAt: Date.now(),
    },
  });

  return ok({ success: true });
}
