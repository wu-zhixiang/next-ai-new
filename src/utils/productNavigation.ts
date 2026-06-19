import Taro from '@tarojs/taro';

const PROMOTED_PRODUCT_CODE_KEY = 'gpt_pay_promoted_product_code';

export function setPromotedProductCode(productCode: string): void {
  if (!productCode) return;
  Taro.setStorageSync(PROMOTED_PRODUCT_CODE_KEY, productCode);
}

export function consumePromotedProductCode(): string {
  const productCode = Taro.getStorageSync(PROMOTED_PRODUCT_CODE_KEY);
  Taro.removeStorageSync(PROMOTED_PRODUCT_CODE_KEY);
  return typeof productCode === 'string' ? productCode : '';
}
