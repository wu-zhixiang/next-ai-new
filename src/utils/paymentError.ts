export const PAYMENT_CANCEL_CODE = 'PAY_CANCEL';
export const ORDER_CLOSED_CODE = 'ORDER_CLOSED';

interface ClassifiedPaymentError {
  code?: string;
  message: string;
}

function getPaymentErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && typeof error === 'object' && 'errMsg' in error) {
    const errMsg = (error as { errMsg?: unknown }).errMsg;
    return typeof errMsg === 'string' ? errMsg : String(errMsg ?? '');
  }
  return String(error ?? '');
}

export function classifyPaymentError(error: unknown): ClassifiedPaymentError {
  const message = getPaymentErrorMessage(error);
  const normalizedMessage = message.toLowerCase();

  if (normalizedMessage.includes('order_closed')) {
    return {
      code: ORDER_CLOSED_CODE,
      message: '订单已关闭，请重新下单',
    };
  }
  if (normalizedMessage.includes('cancel') || message.includes('取消')) {
    return {
      code: PAYMENT_CANCEL_CODE,
      message: '支付已取消',
    };
  }
  return {
    code: undefined,
    message: message || '支付失败，请稍后再试',
  };
}
