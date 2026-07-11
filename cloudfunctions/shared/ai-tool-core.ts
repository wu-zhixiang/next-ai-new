export type AiToolId = 'articleSummary' | 'copywriting' | 'imageGenerate' | 'imageRepair';
export type AiToolOutputType = 'summary' | 'bullets' | 'xiaohongshu' | 'moments' | 'image';
export type AiToolSource = 'miniapp' | 'wechat_ai_skill';
export type AiToolRunStatus = 'processing' | 'succeeded' | 'failed';
export type AiToolErrorCode =
  | 'UNAUTHENTICATED'
  | 'TOOL_DISABLED'
  | 'QUOTA_EXCEEDED'
  | 'INVALID_INPUT'
  | 'MODEL_FAILED'
  | 'CONTENT_REJECTED'
  | 'NOT_FOUND';

export interface AiToolDefinition {
  toolId: AiToolId;
  name: string;
  description: string;
  category: 'text' | 'image' | 'office';
  enabled: boolean;
  inputModes: Array<'text' | 'file' | 'image'>;
  outputModes: AiToolOutputType[];
  memberOnly?: boolean;
  dailyFreeLimit: number;
}

export interface RunAiToolInput {
  toolId?: string;
  outputType?: string;
  text?: string;
  content?: string;
  fileText?: string;
  fileName?: string;
  fileType?: string;
  imageDataUrl?: string;
  assetIds?: unknown;
  options?: Record<string, unknown>;
  source?: string;
  adUnlocked?: boolean;
  rewardAdUnlocked?: boolean;
}

export interface NormalizedRunAiToolInput {
  toolId: AiToolId;
  outputType: Exclude<AiToolOutputType, 'image'>;
  text: string;
  fileText: string;
  fileName: string;
  fileType: string;
  imageDataUrl: string;
  assetIds: string[];
  source: AiToolSource;
  rewardAdUnlocked: boolean;
}

export interface AiToolUsageView {
  charged: boolean;
  freeUsed: boolean;
  rewardAdUsed: boolean;
  memberUsed: boolean;
  dailyFreeLimit: number;
  dailyFreeRemaining: number;
  chargeMode?: 'trial' | 'points' | 'single';
  pointCost?: number;
  aiToolPointsBalance?: number;
  singlePurchaseAmount?: number;
  model?: string;
}

export interface RunAiToolResult {
  runId: string;
  status: AiToolRunStatus;
  toolId: AiToolId;
  title: string;
  summary?: string;
  points?: string[];
  outputText?: string;
  outputImages?: Array<{
    fileId: string;
    url?: string;
    width?: number;
    height?: number;
  }>;
  usage: AiToolUsageView;
  createdAt: number;
}

export interface AiToolQuotaExceededData {
  code: 'QUOTA_EXCEEDED';
  toolId: AiToolId;
  pointCost: number;
  aiToolPointsBalance: number;
  singlePurchaseAmount: number;
}

export type NormalizedRunAiToolInputResult =
  | { ok: true; input: NormalizedRunAiToolInput }
  | { ok: false; code: AiToolErrorCode; message: string };

export type AiToolEntitlementResult =
  | { allowed: true; reason: 'member' | 'free' | 'reward_ad'; usage: AiToolUsageView }
  | { allowed: false; code: 'QUOTA_EXCEEDED'; message: string };

export const AI_TOOL_DAILY_FREE_LIMIT = 1;
export const CHINA_TIMEZONE_OFFSET_MS = 8 * 60 * 60 * 1000;
export const MAX_TEXT_LENGTH = 6000;
export const MAX_FILE_TEXT_LENGTH = 6000;
export const MAX_IMAGE_DATA_URL_LENGTH = 2.5 * 1024 * 1024;

export const AI_TOOL_DEFINITIONS: AiToolDefinition[] = [
  {
    toolId: 'articleSummary',
    name: '摘要总结',
    description: '长文、帖子、会议记录提炼结论和要点。',
    category: 'text',
    enabled: true,
    inputModes: ['text', 'file', 'image'],
    outputModes: ['summary', 'bullets', 'xiaohongshu', 'moments'],
    dailyFreeLimit: AI_TOOL_DAILY_FREE_LIMIT,
  },
  {
    toolId: 'copywriting',
    name: '文案生成',
    description: '把素材改写成小红书或朋友圈文案。',
    category: 'text',
    enabled: true,
    inputModes: ['text', 'file', 'image'],
    outputModes: ['xiaohongshu', 'moments'],
    dailyFreeLimit: AI_TOOL_DAILY_FREE_LIMIT,
  },
  {
    toolId: 'imageGenerate',
    name: 'AI 生图',
    description: '头像、海报、配图生成。',
    category: 'image',
    enabled: false,
    inputModes: ['text'],
    outputModes: ['image'],
    dailyFreeLimit: AI_TOOL_DAILY_FREE_LIMIT,
  },
  {
    toolId: 'imageRepair',
    name: '老照片修复',
    description: '老照片褪色、划痕、模糊修复。',
    category: 'image',
    enabled: false,
    inputModes: ['image', 'text'],
    outputModes: ['image'],
    dailyFreeLimit: AI_TOOL_DAILY_FREE_LIMIT,
  },
];

const LEGACY_PROMPT_PREFIXES = [
  '请帮我总结这篇 AI 资讯，突出核心变化、影响范围和普通用户应该关注的点：',
  '请把下面内容整理成行动清单，按优先级输出，避免空泛建议：',
  '请把下面内容改写成克制可信的小红书风格文案，包含标题、正文和标签：',
  '请把下面内容改写成适合朋友圈发布的短文案，语气自然、有信息密度：',
];

export function getAiToolDefinition(toolId: string): AiToolDefinition | undefined {
  return AI_TOOL_DEFINITIONS.find((item) => item.toolId === toolId);
}

export function getAiToolUsageDateKey(timestamp = Date.now()): string {
  const chinaDate = new Date(timestamp + CHINA_TIMEZONE_OFFSET_MS);
  return chinaDate.toISOString().slice(0, 10);
}

export function stripLegacyPromptPrefixes(value: string): string {
  return LEGACY_PROMPT_PREFIXES.reduce(
    (next, prefix) => next.split(prefix).join(''),
    value,
  ).trim();
}

export function sanitizeText(value?: string): string {
  return stripLegacyPromptPrefixes(String(value || '')).slice(0, MAX_TEXT_LENGTH);
}

export function sanitizeFileText(value?: string): string {
  return String(value || '').trim().slice(0, MAX_FILE_TEXT_LENGTH);
}

export function sanitizeFileName(value?: string): string {
  return String(value || '').trim().replace(/[^\w.\-\u4e00-\u9fa5]/g, '').slice(0, 80);
}

export function sanitizeFileType(value?: string): string {
  return String(value || '').trim().slice(0, 80);
}

export function sanitizeImageDataUrl(value?: string): string {
  const imageDataUrl = String(value || '').trim();
  if (!imageDataUrl) {
    return '';
  }
  if (!/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/.test(imageDataUrl)) {
    return '';
  }
  return imageDataUrl.length <= MAX_IMAGE_DATA_URL_LENGTH ? imageDataUrl : '';
}

function normalizeToolId(value?: string): AiToolId {
  if (
    value === 'copywriting'
    || value === 'imageGenerate'
    || value === 'imageRepair'
    || value === 'articleSummary'
  ) {
    return value;
  }
  return 'articleSummary';
}

function normalizeOutputType(toolId: AiToolId, value?: string): Exclude<AiToolOutputType, 'image'> {
  if (toolId === 'copywriting') {
    return value === 'moments' ? 'moments' : 'xiaohongshu';
  }
  if (value === 'bullets' || value === 'xiaohongshu' || value === 'moments') {
    return value;
  }
  return 'summary';
}

function normalizeAssetIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean)
    .slice(0, 10);
}

function normalizeSource(value?: string): AiToolSource {
  return value === 'wechat_ai_skill' ? 'wechat_ai_skill' : 'miniapp';
}

export function normalizeRunAiToolInput(event: RunAiToolInput = {}): NormalizedRunAiToolInputResult {
  const toolId = normalizeToolId(event.toolId);
  const definition = getAiToolDefinition(toolId);
  if (!definition) {
    return {
      ok: false,
      code: 'TOOL_DISABLED',
      message: '该工具暂未开放',
    };
  }

  const text = sanitizeText(event.text ?? event.content);
  const fileText = sanitizeFileText(event.fileText);
  const imageDataUrl = sanitizeImageDataUrl(event.imageDataUrl);
  if (!text && !fileText && !imageDataUrl) {
    return {
      ok: false,
      code: 'INVALID_INPUT',
      message: '请输入内容或添加素材',
    };
  }

  return {
    ok: true,
    input: {
      toolId,
      outputType: normalizeOutputType(toolId, event.outputType),
      text,
      fileText,
      fileName: sanitizeFileName(event.fileName),
      fileType: sanitizeFileType(event.fileType),
      imageDataUrl,
      assetIds: normalizeAssetIds(event.assetIds),
      source: normalizeSource(event.source),
      rewardAdUnlocked: Boolean(event.rewardAdUnlocked || event.adUnlocked),
    },
  };
}

export function resolveAiToolEntitlement(params: {
  isMember: boolean;
  freeUsedToday: number;
  rewardAdUnlocked: boolean;
}): AiToolEntitlementResult {
  if (params.isMember) {
    return {
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
    };
  }

  if (params.freeUsedToday < AI_TOOL_DAILY_FREE_LIMIT) {
    return {
      allowed: true,
      reason: 'free',
      usage: {
        charged: false,
        freeUsed: true,
        rewardAdUsed: false,
        memberUsed: false,
        dailyFreeLimit: AI_TOOL_DAILY_FREE_LIMIT,
        dailyFreeRemaining: Math.max(0, AI_TOOL_DAILY_FREE_LIMIT - params.freeUsedToday - 1),
      },
    };
  }

  if (params.rewardAdUnlocked) {
    return {
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
    };
  }

  return {
    allowed: false,
    code: 'QUOTA_EXCEEDED',
    message: '今日免费次数已用完',
  };
}
