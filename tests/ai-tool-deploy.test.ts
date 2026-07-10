import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('AI tool cloud functions deploy an SDK version that includes CloudBase AI', () => {
  const buildScript = fs.readFileSync('scripts/build-cloudfunctions.mjs', 'utf8');
  assert.match(buildScript, /'@cloudbase\/node-sdk': '3\.18\.4'/);
});
