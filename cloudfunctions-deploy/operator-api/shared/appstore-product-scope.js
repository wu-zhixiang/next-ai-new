"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPSTORE_ALL_PRODUCT_NAME = exports.APPSTORE_ALL_PRODUCT_CODE = void 0;
exports.appStoreAccountMatchesProduct = appStoreAccountMatchesProduct;
exports.getAppStoreProductMatchPriority = getAppStoreProductMatchPriority;
exports.APPSTORE_ALL_PRODUCT_CODE = 'all';
exports.APPSTORE_ALL_PRODUCT_NAME = '全部商品';
function appStoreAccountMatchesProduct(accountProductCode, orderProductCode) {
    return accountProductCode === exports.APPSTORE_ALL_PRODUCT_CODE || accountProductCode === orderProductCode;
}
function getAppStoreProductMatchPriority(accountProductCode, orderProductCode) {
    if (accountProductCode === orderProductCode) {
        return 0;
    }
    if (accountProductCode === exports.APPSTORE_ALL_PRODUCT_CODE) {
        return 1;
    }
    return 2;
}
