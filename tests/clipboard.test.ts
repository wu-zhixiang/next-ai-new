import assert from 'node:assert/strict';
import test from 'node:test';

import { copyWithToast, maskSecret } from '../src/utils/clipboard.ts';

test('maskSecret replaces every password character with an asterisk', () => {
  assert.equal(maskSecret('Secret123!'), '**********');
  assert.equal(maskSecret('密码A1!'), '*****');
  assert.equal(maskSecret(''), '');
});

test('copyWithToast copies the account and shows a success toast', async () => {
  const copiedValues: string[] = [];
  const toastTitles: string[] = [];
  let hideToastCount = 0;

  const copied = await copyWithToast('member@example.com', '账号', {
    setClipboardData: async (value) => {
      copiedValues.push(value);
    },
    hideToast: async () => {
      hideToastCount += 1;
    },
    showToast: async (title) => {
      toastTitles.push(title);
    },
  });

  assert.equal(copied, true);
  assert.deepEqual(copiedValues, ['member@example.com']);
  assert.equal(hideToastCount, 1);
  assert.deepEqual(toastTitles, ['账号已复制']);
});

test('copyWithToast copies the password and shows a success toast', async () => {
  const toastTitles: string[] = [];

  const copied = await copyWithToast('Secret123!', '密码', {
    setClipboardData: async () => undefined,
    hideToast: async () => undefined,
    showToast: async (title) => {
      toastTitles.push(title);
    },
  });

  assert.equal(copied, true);
  assert.deepEqual(toastTitles, ['密码已复制']);
});

test('copyWithToast copies the verification code and shows a success toast', async () => {
  const toastTitles: string[] = [];

  const copied = await copyWithToast('123456', '验证码', {
    setClipboardData: async () => undefined,
    hideToast: async () => undefined,
    showToast: async (title) => {
      toastTitles.push(title);
    },
  });

  assert.equal(copied, true);
  assert.deepEqual(toastTitles, ['验证码已复制']);
});

test('copyWithToast shows a failure toast when clipboard access fails', async () => {
  const toastTitles: string[] = [];

  const copied = await copyWithToast('Secret123!', '密码', {
    setClipboardData: async () => {
      throw new Error('clipboard unavailable');
    },
    hideToast: async () => undefined,
    showToast: async (title) => {
      toastTitles.push(title);
    },
  });

  assert.equal(copied, false);
  assert.deepEqual(toastTitles, ['复制失败，请重试']);
});

test('copyWithToast keeps the successful result when the custom toast fails', async () => {
  const copied = await copyWithToast('member@example.com', '账号', {
    setClipboardData: async () => undefined,
    hideToast: async () => undefined,
    showToast: async () => {
      throw new Error('toast conflict');
    },
  });

  assert.equal(copied, true);
});
