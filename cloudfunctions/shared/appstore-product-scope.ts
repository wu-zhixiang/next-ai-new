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

interface ReusableAppStoreAccount {
  productCode?: string;
  status?: string;
  updatedAt?: number;
}

export function selectReusableAppStoreAccount<T extends ReusableAppStoreAccount>(
  accounts: T[],
  orderProductCode: string,
): T | null {
  return accounts
    .filter((account) => (
      account.status === 'bound'
      && appStoreAccountMatchesProduct(account.productCode ?? '', orderProductCode)
    ))
    .sort((left, right) => {
      const priorityDiff = getAppStoreProductMatchPriority(
        left.productCode ?? '',
        orderProductCode,
      ) - getAppStoreProductMatchPriority(
        right.productCode ?? '',
        orderProductCode,
      );
      return priorityDiff || (right.updatedAt ?? 0) - (left.updatedAt ?? 0);
    })[0] ?? null;
}
