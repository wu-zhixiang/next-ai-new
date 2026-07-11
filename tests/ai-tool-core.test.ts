import assert from 'node:assert/strict';
import test from 'node:test';

import {
  AI_TOOL_DAILY_FREE_LIMIT,
  getAiToolUsageDateKey,
  getAiToolDefinition,
  normalizeRunAiToolInput,
  resolveAiToolEntitlement,
} from '../cloudfunctions/shared/ai-tool-core.ts';

test('run AI tool input defaults to article summary and strips legacy prompt text', () => {
  const result = normalizeRunAiToolInput({
    content: '请帮我总结这篇 AI 资讯，突出核心变化、影响范围和普通用户应该关注的点：  这是一段需要总结的内容  ',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;

  assert.equal(result.input.toolId, 'articleSummary');
  assert.equal(result.input.outputType, 'summary');
  assert.equal(result.input.text, '这是一段需要总结的内容');
  assert.equal(result.input.source, 'miniapp');
});

test('run AI tool input leaves image tool enablement to runtime config', () => {
  const result = normalizeRunAiToolInput({
    toolId: 'imageGenerate',
    text: '生成一张头像',
  });

  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal(result.input.toolId, 'imageGenerate');
  assert.equal(result.input.text, '生成一张头像');
});

test('image repair tool is named old photo restoration in shared definitions', () => {
  const definition = getAiToolDefinition('imageRepair');

  assert.equal(definition?.name, '老照片修复');
  assert.match(definition?.description || '', /老照片/);
});

test('run AI tool input requires text or a readable image/file context', () => {
  const result = normalizeRunAiToolInput({
    toolId: 'articleSummary',
    outputType: 'bullets',
    text: '   ',
  });

  assert.deepEqual(result, {
    ok: false,
    code: 'INVALID_INPUT',
    message: '请输入内容或添加素材',
  });
});

test('AI tool usage date key uses China timezone boundaries', () => {
  assert.equal(getAiToolUsageDateKey(Date.UTC(2026, 6, 9, 15, 59, 59)), '2026-07-09');
  assert.equal(getAiToolUsageDateKey(Date.UTC(2026, 6, 9, 16, 0, 0)), '2026-07-10');
});

test('AI tool entitlement allows members and first daily free use', () => {
  assert.deepEqual(
    resolveAiToolEntitlement({
      isMember: true,
      freeUsedToday: 9,
      rewardAdUnlocked: false,
    }),
    {
      allowed: true,
      reason: 'member',
      usage: {
        charged: false,
        freeUsed: false,
        rewardAdUsed: false,
        memberUsed: true,
        dailyFreeLimit: AI_TOOL_DAILY_FREE_LIMIT,
        dailyFreeRemaining: 0,
      },
    },
  );

  assert.deepEqual(
    resolveAiToolEntitlement({
      isMember: false,
      freeUsedToday: 0,
      rewardAdUnlocked: false,
    }),
    {
      allowed: true,
      reason: 'free',
      usage: {
        charged: false,
        freeUsed: true,
        rewardAdUsed: false,
        memberUsed: false,
        dailyFreeLimit: AI_TOOL_DAILY_FREE_LIMIT,
        dailyFreeRemaining: 0,
      },
    },
  );
});

test('AI tool entitlement blocks non-members after daily free use unless reward ad is unlocked', () => {
  assert.deepEqual(
    resolveAiToolEntitlement({
      isMember: false,
      freeUsedToday: 1,
      rewardAdUnlocked: false,
    }),
    {
      allowed: false,
      code: 'QUOTA_EXCEEDED',
      message: '今日免费次数已用完',
    },
  );

  assert.deepEqual(
    resolveAiToolEntitlement({
      isMember: false,
      freeUsedToday: 1,
      rewardAdUnlocked: true,
    }),
    {
      allowed: true,
      reason: 'reward_ad',
      usage: {
        charged: false,
        freeUsed: false,
        rewardAdUsed: true,
        memberUsed: false,
        dailyFreeLimit: AI_TOOL_DAILY_FREE_LIMIT,
        dailyFreeRemaining: 0,
      },
    },
  );
});
