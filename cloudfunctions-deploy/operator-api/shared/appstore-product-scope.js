"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APPSTORE_ALL_PRODUCT_NAME = exports.APPSTORE_ALL_PRODUCT_CODE = void 0;
exports.appStoreAccountMatchesProduct = appStoreAccountMatchesProduct;
exports.getAppStoreProductMatchPriority = getAppStoreProductMatchPriority;
exports.selectReusableAppStoreAccount = selectReusableAppStoreAccount;
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
function selectReusableAppStoreAccount(accounts, orderProductCode) {
    var _a;
    return (_a = accounts
        .filter((account) => {
        var _a;
        return (account.status === 'bound'
            && appStoreAccountMatchesProduct((_a = account.productCode) !== null && _a !== void 0 ? _a : '', orderProductCode));
    })
        .sort((left, right) => {
        var _a, _b, _c, _d;
        const priorityDiff = getAppStoreProductMatchPriority((_a = left.productCode) !== null && _a !== void 0 ? _a : '', orderProductCode) - getAppStoreProductMatchPriority((_b = right.productCode) !== null && _b !== void 0 ? _b : '', orderProductCode);
        return priorityDiff || ((_c = right.updatedAt) !== null && _c !== void 0 ? _c : 0) - ((_d = left.updatedAt) !== null && _d !== void 0 ? _d : 0);
    })[0]) !== null && _a !== void 0 ? _a : null;
}
