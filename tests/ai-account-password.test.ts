import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AI_ACCOUNT_PASSWORD_HINT as SERVER_PASSWORD_HINT,
  validateAiAccountPassword as validateServerPassword,
} from '../cloudfunctions/shared/ai-account-password.ts';
import {
  AI_ACCOUNT_PASSWORD_HINT as CLIENT_PASSWORD_HINT,
  validateAiAccountPassword as validateClientPassword,
} from '../src/utils/aiAccountPassword.ts';

const passwordValidators = [
  ['client', validateClientPassword],
  ['server', validateServerPassword],
] as const;

test('AI account password requires at least 12 characters', () => {
  for (const [side, validatePassword] of passwordValidators) {
    assert.equal(validatePassword('Aa1!aaaaaaa'), '密码需为12-64位', side);
    assert.equal(validatePassword('Aa1!aaaaaaaa'), undefined, side);
  }
  assert.equal(CLIENT_PASSWORD_HINT, '12-64位，含大小写字母、数字和特殊符号');
  assert.equal(SERVER_PASSWORD_HINT, CLIENT_PASSWORD_HINT);
});

test('AI account password rejects values longer than 64 characters', () => {
  for (const [side, validatePassword] of passwordValidators) {
    assert.equal(validatePassword(`Aa1!${'a'.repeat(61)}`), '密码需为12-64位', side);
  }
});

test('AI account password requires all character groups and no whitespace', () => {
  for (const [side, validatePassword] of passwordValidators) {
    assert.equal(validatePassword('Aa1!aaaa aaa'), '密码不能包含空格', side);
    assert.equal(
      validatePassword('aaaaaaaaaaaa'),
      '密码需包含大小写字母、数字和特殊符号',
      side,
    );
  }
});
