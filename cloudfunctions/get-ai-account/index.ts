import { getUserByOpenId } from '../shared/db';
import { decryptAiAccountPassword } from '../shared/ai-account';
import { ok } from '../shared/utils';
import { getWxContext } from '../_lib/context';

export async function main() {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    throw new Error('请先登录后再查看账号信息');
  }
  if (!user.aiAccountEmail || !user.aiAccountPasswordEncrypted) {
    throw new Error('暂未注册 AI 账号');
  }

  return ok({
    email: user.aiAccountEmail,
    password: decryptAiAccountPassword(user.aiAccountPasswordEncrypted),
  });
}
