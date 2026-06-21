import assert from 'node:assert/strict';
import test from 'node:test';

import {
  classifyPaymentError,
  PAYMENT_CANCEL_CODE,
} from '../src/utils/paymentError.ts';

test('payment error classifier identifies user cancellation', () => {
  assert.deepEqual(
    classifyPaymentError({ errMsg: 'requestPayment:fail cancel' }),
    {
      code: PAYMENT_CANCEL_CODE,
      message: '支付已取消',
    },
  );
  assert.deepEqual(
    classifyPaymentError(new Error('requestVirtualPayment:fail user cancel')),
    {
      code: PAYMENT_CANCEL_CODE,
      message: '支付已取消',
    },
  );
});

test('payment error classifier identifies closed orders', () => {
  assert.deepEqual(
    classifyPaymentError({ errMsg: 'requestVirtualPayment:fail ORDER_CLOSED' }),
    {
      code: 'ORDER_CLOSED',
      message: '订单已关闭，请重新下单',
    },
  );
});

test('payment error classifier preserves real payment errors', () => {
  assert.deepEqual(
    classifyPaymentError({ errMsg: 'requestPayment:fail system error' }),
    {
      code: undefined,
      message: 'requestPayment:fail system error',
    },
  );
});
