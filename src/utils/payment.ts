import Taro from '@tarojs/taro';
import {
  classifyPaymentError,
  ORDER_CLOSED_CODE,
  PAYMENT_CANCEL_CODE,
} from '@/utils/paymentError';

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
  paymentType?: 'wechat' | 'virtual' | 'points';
  payment?: WechatPaymentParams;
  virtualPayment?: WechatVirtualPaymentParams;
}

export class MiniProgramPaymentError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'MiniProgramPaymentError';
    this.code = code;
  }
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
        const classified = classifyPaymentError(error);
        reject(new MiniProgramPaymentError(classified.message, classified.code));
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
    try {
      await Taro.requestPayment({ ...result.payment });
    } catch (error) {
      const classified = classifyPaymentError(error);
      throw new MiniProgramPaymentError(classified.message, classified.code);
    }
  }
}

export { ORDER_CLOSED_CODE, PAYMENT_CANCEL_CODE };
