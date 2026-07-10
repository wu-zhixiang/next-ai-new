import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getToolById,
  getToolDetailUrl,
  getToolEntryUrl,
  hasToolIntro,
} from '../src/pages/tools/definitions.ts';

test('image repair is presented as old photo restoration', () => {
  const tool = getToolById('imageRepair');

  assert.equal(tool.name, '老照片修复');
  assert.match(tool.desc, /老照片/);
});

test('tools with intro content and cases route through intro page', () => {
  const imageGenerate = getToolById('imageGenerate');
  const imageRepair = getToolById('imageRepair');
  const articleSummary = getToolById('articleSummary');

  assert.equal(hasToolIntro(imageGenerate), true);
  assert.equal(hasToolIntro(imageRepair), true);
  assert.equal(hasToolIntro(articleSummary), false);
  assert.equal(getToolEntryUrl(imageGenerate), '/pages/tool-intro/index?tool=imageGenerate');
  assert.equal(getToolEntryUrl(imageRepair), '/pages/tool-intro/index?tool=imageRepair');
  assert.equal(getToolEntryUrl(articleSummary), '/pages/tool-detail/index?tool=articleSummary');
});

test('tool detail URL always points to the workbench page', () => {
  assert.equal(getToolDetailUrl('imageGenerate'), '/pages/tool-detail/index?tool=imageGenerate');
});
