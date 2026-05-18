import { getLatestEmailVerificationCode, getLatestUnusedEmailVerificationCode, getUserByOpenId } from '../shared/db';
import { ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

export async function main() {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    throw new Error('请先登录后再查看验证码');
  }
  if (!user.aiAccountEmail) {
    throw new Error('当前用户未绑定 AI 账号');
  }

  const latestValidCode = await getLatestEmailVerificationCode(user._id);
  const latestCode = latestValidCode ?? await getLatestUnusedEmailVerificationCode(user._id);
  if (!latestCode) {
    console.info(
      JSON.stringify({
        tag: 'emailCode.latest.missing',
        userId: user._id,
        email: user.aiAccountEmail,
      }),
    );
    return ok({
      hasCode: false,
      email: user.aiAccountEmail,
    });
  }

  console.info(
    JSON.stringify({
      tag: 'emailCode.latest.found',
      userId: user._id,
      email: latestCode.email,
      codeId: latestCode._id,
      expired: latestCode.expiresAt <= Date.now(),
      used: Boolean(latestCode.usedAt),
    }),
  );

  return ok({
    hasCode: true,
    codeId: latestCode._id,
    email: latestCode.email,
    code: latestCode.code,
    provider: latestCode.provider,
    receivedAt: latestCode.receivedAt,
    expiresAt: latestCode.expiresAt,
    expired: latestCode.expiresAt <= Date.now(),
  });
}
