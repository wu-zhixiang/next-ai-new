import Taro from '@tarojs/taro';

export interface WechatPaymentParams {
  timeStamp: string;
  nonceStr: string;
  package: string;
  signType: 'MD5' | 'RSA';
  paySign: string;
}

export interface WechatVirtualPaymentParams {
  signData: string;
  paySig: string;
  signature: string;
  mode: 'short_series_goods';
}

export interface PayOrderResult {
  paid?: boolean;
  message?: string;
  paymentType?: 'wechat' | 'virtual';
  payment?: WechatPaymentParams;
  virtualPayment?: WechatVirtualPaymentParams;
}

export async function createPayOrderPayload(orderNo: string): Promise<{ orderNo: string; jsCode?: string }> {
  try {
    const login = await Taro.login();
    return {
      orderNo,
      jsCode: login.code,
    };
  } catch {
    return { orderNo };
  }
}

export function requestVirtualPayment(params: WechatVirtualPaymentParams): Promise<void> {
  if (!wx.canIUse('requestVirtualPayment')) {
    return Promise.reject(new Error('当前微信版本暂不支持小程序虚拟支付，请升级微信后重试'));
  }

  const requestVirtualPaymentApi = wx.requestVirtualPayment as unknown as (options: WechatVirtualPaymentParams & {
    success: () => void;
    fail: (error: { errMsg?: string }) => void;
  }) => void;

  return new Promise((resolve, reject) => {
    requestVirtualPaymentApi({
      ...params,
      success: () => resolve(),
      fail: (error) => {
        const errMsg = error.errMsg || '虚拟支付失败';
        reject(new Error(errMsg));
      },
    });
  });
}

export async function requestMiniProgramPayment(result: PayOrderResult): Promise<void> {
  if (result.virtualPayment) {
    await requestVirtualPayment(result.virtualPayment);
    return;
  }
  if (result.payment) {
    await Taro.requestPayment({ ...result.payment });
  }
}
