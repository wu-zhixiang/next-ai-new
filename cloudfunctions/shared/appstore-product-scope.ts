export const APPSTORE_ALL_PRODUCT_CODE = 'all';
export const APPSTORE_ALL_PRODUCT_NAME = '全部商品';

export function appStoreAccountMatchesProduct(accountProductCode: string, orderProductCode: string): boolean {
  return accountProductCode === APPSTORE_ALL_PRODUCT_CODE || accountProductCode === orderProductCode;
}

export function getAppStoreProductMatchPriority(accountProductCode: string, orderProductCode: string): number {
  if (accountProductCode === orderProductCode) {
    return 0;
  }
  if (accountProductCode === APPSTORE_ALL_PRODUCT_CODE) {
    return 1;
  }
  return 2;
}
