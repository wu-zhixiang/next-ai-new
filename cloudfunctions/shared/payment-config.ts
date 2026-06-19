import type { PayChannel } from './types';

export type PaymentType = 'virtual' | 'standard';

export function normalizePaymentType(value: unknown): PaymentType {
  return value === 'standard' ? 'standard' : 'virtual';
}

export function paymentTypeToPayChannel(paymentType: PaymentType): PayChannel {
  return paymentType === 'standard' ? 'wechat_pay' : 'wechat_virtual_pay';
}
