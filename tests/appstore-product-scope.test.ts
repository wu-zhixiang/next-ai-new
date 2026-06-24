import assert from 'node:assert/strict';
import test from 'node:test';

import {
  APPSTORE_ALL_PRODUCT_CODE,
  appStoreAccountMatchesProduct,
  getAppStoreProductMatchPriority,
  selectReusableAppStoreAccount,
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

test('repeated orders reuse the newest compatible Apple Store account for the same email', () => {
  const selected = selectReusableAppStoreAccount([
    {
      id: 'claude-account',
      productCode: 'claude_pro',
      status: 'bound',
      updatedAt: 300,
    },
    {
      id: 'older-chatgpt-account',
      productCode: 'ai_news',
      status: 'bound',
      updatedAt: 100,
    },
    {
      id: 'newer-chatgpt-account',
      productCode: 'ai_news',
      status: 'bound',
      updatedAt: 200,
    },
  ], 'ai_news');

  assert.equal(selected?.id, 'newer-chatgpt-account');
});

test('a product-specific account is reused before a newer ALL account', () => {
  const selected = selectReusableAppStoreAccount([
    {
      id: 'all-account',
      productCode: APPSTORE_ALL_PRODUCT_CODE,
      status: 'bound',
      updatedAt: 300,
    },
    {
      id: 'specific-account',
      productCode: 'ai_news',
      status: 'bound',
      updatedAt: 100,
    },
  ], 'ai_news');

  assert.equal(selected?.id, 'specific-account');
});
