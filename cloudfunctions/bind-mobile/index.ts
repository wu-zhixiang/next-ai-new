import { collection, getUserByOpenId } from '../shared/db';
import { isValidMainlandMobile, maskMobile, normalizeMobile, ok } from '../shared/utils';
import { getWechatPhoneNumber } from '../shared/wechat';
import { getWxContext } from '../_lib/context';

interface Event {
  mobile?: string;
  code?: string;
  encryptedData?: string;
  iv?: string;
  source?: 'manual' | 'wechat_phone';
}

export async function main(event: Event) {
  const { OPENID } = getWxContext();
  const user = await getUserByOpenId(OPENID);
  if (!user) {
    throw new Error('用户未登录');
  }

  let mobile = normalizeMobile(event.mobile);
  if (!mobile && (event.source === 'wechat_phone' || event.code)) {
    if (!event.code) {
      throw new Error('缺少微信手机号授权 code');
    }
    mobile = normalizeMobile(await getWechatPhoneNumber(event.code));
  }

  if (!mobile) {
    throw new Error('缺少手机号信息');
  }
  if (!isValidMainlandMobile(mobile)) {
    throw new Error('手机号格式不正确');
  }

  await collection('users').doc(user._id).update({
    data: {
      mobile,
      updatedAt: Date.now(),
    },
  });

  return ok({
    success: true,
    mobile: maskMobile(mobile),
  });
}
