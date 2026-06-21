import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APPSTORE_ALL_PRODUCT_CODE,
  appStoreAccountMatchesProduct,
  getAppStoreProductMatchPriority,
} from '../cloudfunctions/shared/appstore-product-scope.ts';

test('ALL Apple Store accounts match every product', () => {
  assert.equal(appStoreAccountMatchesProduct(APPSTORE_ALL_PRODUCT_CODE, 'ai_news'), true);
  assert.equal(appStoreAccountMatchesProduct(APPSTORE_ALL_PRODUCT_CODE, 'claude_pro'), true);
});

test('specific Apple Store accounts only match their own product', () => {
  assert.equal(appStoreAccountMatchesProduct('ai_news', 'ai_news'), true);
  assert.equal(appStoreAccountMatchesProduct('ai_news', 'claude_pro'), false);
});

test('specific accounts have priority over ALL accounts', () => {
  assert.equal(getAppStoreProductMatchPriority('ai_news', 'ai_news'), 0);
  assert.equal(getAppStoreProductMatchPriority(APPSTORE_ALL_PRODUCT_CODE, 'ai_news'), 1);
  assert.equal(getAppStoreProductMatchPriority('claude_pro', 'ai_news'), 2);
});
