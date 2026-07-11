import {
  AI_TOOL_DEFINITIONS,
  type AiToolDefinition,
  type AiToolId,
  type AiToolOutputType,
} from './ai-tool-core';

export type AiToolConfigStatus = 'enabled' | 'disabled' | 'testing';
export type AiToolConfigCategory = 'text' | 'image' | 'video' | 'workflow';
export type AiToolTextOutputType = Exclude<AiToolOutputType, 'image'>;
export type AiToolIntroCaseMode = 'compare' | 'preview';

export interface AiToolIntroHighlightConfig {
  title: string;
  desc: string;
}

export interface AiToolIntroCompareCaseConfig {
  mode: 'compare';
  title: string;
  before: string;
  after: string;
  beforeImageFileId?: string;
  afterImageFileId?: string;
}

export interface AiToolIntroPreviewCaseConfig {
  mode: 'preview';
  title: string;
  previewImageFileId: string;
  previewDescription?: string;
}

export type AiToolIntroCaseConfig = AiToolIntroCompareCaseConfig | AiToolIntroPreviewCaseConfig;

export interface AiToolIntroConfig {
  eyebrow: string;
  title: string;
  subtitle: string;
  highlights: AiToolIntroHighlightConfig[];
  cases: AiToolIntroCaseConfig[];
  tips?: string[];
}

export interface AiToolCardConfig {
  title: string;
  description: string;
  badge: string;
  tags: string[];
  icon: string;
  iconImageFileId?: string;
  visible: boolean;
  sortOrder: number;
  outputType: AiToolTextOutputType;
}

export interface AiToolConfigRecord {
  _id?: string;
  toolId?: string;
  name: string;
  category: AiToolConfigCategory;
  status: AiToolConfigStatus;
  runCount: number;
  pointCost: number;
  trialLimit?: number;
  createdAt: number;
  updatedAt: number;
  builtIn?: boolean;
  deleted?: boolean;
  cardTitle?: string;
  cardDescription?: string;
  cardBadge?: string;
  tags?: string[];
  icon?: string;
  iconImageFileId?: string;
  visible?: boolean;
  sortOrder?: number;
  outputType?: AiToolTextOutputType;
  intro?: AiToolIntroConfig;
}

export interface AiToolPublicView {
  id: string;
  toolId: string;
  name: string;
  desc: string;
  badge: string;
  tags: string[];
  icon: string;
  iconImageFileId?: string;
  status: AiToolConfigStatus;
  enabled: boolean;
  visible: boolean;
  sortOrder: number;
  outputType: AiToolTextOutputType;
  pointCost: number;
  trialLimit: number;
  intro?: AiToolIntroConfig;
}

export const ADMIN_VISIBLE_DEFAULT_TOOL_IDS = ['articleSummary', 'imageGenerate', 'imageRepair'] as const satisfies readonly AiToolId[];
export const DEFAULT_TOOL_BASELINE_AT = Date.parse('2026-05-12T00:00:00.000Z');
export const DEFAULT_TOOL_POINT_COSTS: Readonly<Record<AiToolId, number>> = {
  articleSummary: 5,
  copywriting: 5,
  imageGenerate: 20,
  imageRepair: 25,
};
export const DEFAULT_TOOL_TRIAL_LIMITS: Readonly<Record<AiToolId, number>> = {
  articleSummary: 1,
  copywriting: 1,
  imageGenerate: 0,
  imageRepair: 1,
};

const DEFAULT_TOOL_CARDS: Readonly<Record<AiToolId, AiToolCardConfig>> = {
  articleSummary: {
    title: '摘要总结',
    description: '长文、帖子、会议记录提炼结论',
    badge: '已上线',
    tags: ['已上线', '免费试用', '内容提效'],
    icon: '总',
    visible: true,
    sortOrder: 10,
    outputType: 'summary',
  },
  copywriting: {
    title: '文案生成',
    description: '小红书、朋友圈文案改写',
    badge: '已上线',
    tags: ['已上线', '文案改写', '社媒发布'],
    icon: '写',
    visible: false,
    sortOrder: 40,
    outputType: 'xiaohongshu',
  },
  imageGenerate: {
    title: 'AI生图',
    description: '头像、海报、配图生成',
    badge: '接入中',
    tags: ['接入中', '头像海报', '图片生成'],
    icon: '图',
    visible: true,
    sortOrder: 20,
    outputType: 'summary',
  },
  imageRepair: {
    title: '老照片修复',
    description: '老照片褪色、划痕、模糊修复',
    badge: '接入中',
    tags: ['接入中', '老照片', '清晰增强'],
    icon: '修',
    visible: true,
    sortOrder: 30,
    outputType: 'summary',
  },
};

const DEFAULT_TOOL_INTROS: Partial<Record<AiToolId, AiToolIntroConfig>> = {
  imageGenerate: {
    eyebrow: 'AI生图',
    title: '把一句想法变成可用图片',
    subtitle: '适合快速生成头像、社交配图、活动海报和内容封面。先选清楚用途，再进入工具页提交提示词。',
    highlights: [
      { title: '用途导向', desc: '围绕头像、封面、海报、商品图等实际场景组织提示词。' },
      { title: '参考素材', desc: '后续可结合参考图做风格延展、布局复刻和局部修改。' },
      { title: '模型分层', desc: '标准模型走低成本生成，高级模型按次数或点数控制成本。' },
    ],
    cases: [
      { mode: 'compare', title: '小红书封面', before: '只有文章标题和主题关键词', after: '生成统一风格封面，便于直接发布' },
      { mode: 'compare', title: '活动海报', before: '一句活动卖点和时间地点', after: '输出带明确视觉主体的海报草图' },
      { mode: 'compare', title: '头像方案', before: '描述人物气质和职业场景', after: '生成多种头像风格方向' },
    ],
    tips: ['主体、场景、风格、尺寸越明确，出图越稳定。', '涉及品牌、人物或版权素材时，请确保你有使用授权。'],
  },
  imageRepair: {
    eyebrow: '老照片修复',
    title: '让旧照片重新清晰',
    subtitle: '面向泛黄、褪色、划痕、折痕和低清扫描件，优先恢复照片可读性和人物细节。',
    highlights: [
      { title: '修复瑕疵', desc: '处理划痕、折痕、污点和扫描噪点，让画面更干净。' },
      { title: '增强清晰度', desc: '改善低清、轻微模糊和压缩损失，保留原照片质感。' },
      { title: '自然还原', desc: '避免过度美化，把重点放在真实照片的色彩和细节恢复。' },
    ],
    cases: [
      { mode: 'compare', title: '泛黄老照片', before: '照片整体发黄、对比度低', after: '肤色和背景更自然，人物轮廓更清楚' },
      { mode: 'compare', title: '折痕划痕', before: '画面有明显折线、白痕或污点', after: '瑕疵区域被修补，画面连续性更好' },
      { mode: 'compare', title: '低清扫描件', before: '老照片翻拍后偏糊、细节弱', after: '面部和服饰细节更容易辨认' },
    ],
    tips: ['请上传你本人拥有或已获授权处理的照片。', '严重缺失的人脸或背景无法保证完全还原，只能做合理修复。'],
  },
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function sanitizeAiToolConfigText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function cloneIntroConfig(intro: AiToolIntroConfig): AiToolIntroConfig {
  return {
    eyebrow: intro.eyebrow,
    title: intro.title,
    subtitle: intro.subtitle,
    highlights: intro.highlights.map((item) => ({ ...item })),
    cases: intro.cases.map((item) => ({ ...item })),
    tips: intro.tips ? [...intro.tips] : undefined,
  };
}

export function getDefaultAdminToolDefinitions(): AiToolDefinition[] {
  return ADMIN_VISIBLE_DEFAULT_TOOL_IDS
    .map((toolId) => AI_TOOL_DEFINITIONS.find((definition) => definition.toolId === toolId))
    .filter((definition): definition is AiToolDefinition => Boolean(definition));
}

export function getDefaultToolCardConfig(toolId: AiToolId): AiToolCardConfig {
  return { ...DEFAULT_TOOL_CARDS[toolId] };
}

export function getDefaultToolIntroConfig(toolId: AiToolId): AiToolIntroConfig | undefined {
  const intro = DEFAULT_TOOL_INTROS[toolId];
  return intro ? cloneIntroConfig(intro) : undefined;
}

export function normalizeToolConfigCategory(value: unknown): AiToolConfigCategory {
  return value === 'image' || value === 'video' || value === 'workflow' ? value : 'text';
}

export function normalizeToolConfigStatus(value: unknown): AiToolConfigStatus {
  return value === 'enabled' || value === 'disabled' ? value : 'testing';
}

export function normalizeDefinitionCategory(category: AiToolDefinition['category']): AiToolConfigCategory {
  return category === 'image' ? 'image' : 'text';
}

export function getDefaultToolStatus(definition: AiToolDefinition): AiToolConfigStatus {
  return definition.enabled ? 'enabled' : 'testing';
}

function normalizeToolOutputType(value: unknown, fallback: AiToolTextOutputType): AiToolTextOutputType {
  return value === 'bullets' || value === 'xiaohongshu' || value === 'moments' ? value : fallback;
}

function normalizeImageFileId(value: unknown): string {
  return sanitizeAiToolConfigText(value, 500);
}

export function normalizeAiToolTags(value: unknown, fallback: readonly string[] = []): string[] {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n，、]+/)
      : fallback;
  const tags: string[] = [];
  for (const item of source) {
    const tag = sanitizeAiToolConfigText(item, 16);
    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
    if (tags.length >= 8) {
      break;
    }
  }
  return tags;
}

export function normalizeAiToolSortOrder(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.floor(numeric)) : fallback;
}

function normalizeHighlight(value: unknown): AiToolIntroHighlightConfig | null {
  if (!isRecord(value)) {
    return null;
  }
  const title = sanitizeAiToolConfigText(value.title, 30);
  const desc = sanitizeAiToolConfigText(value.desc, 120);
  return title || desc ? { title, desc } : null;
}

function normalizeCase(value: unknown): AiToolIntroCaseConfig | null {
  if (!isRecord(value)) {
    return null;
  }
  const title = sanitizeAiToolConfigText(value.title, 40);
  if (value.mode === 'preview') {
    const previewImageFileId = normalizeImageFileId(value.previewImageFileId);
    const previewDescription = sanitizeAiToolConfigText(value.previewDescription, 120);
    return title || previewImageFileId || previewDescription
      ? { mode: 'preview', title, previewImageFileId, previewDescription }
      : null;
  }
  const before = sanitizeAiToolConfigText(value.before, 120);
  const after = sanitizeAiToolConfigText(value.after, 120);
  const beforeImageFileId = normalizeImageFileId(value.beforeImageFileId);
  const afterImageFileId = normalizeImageFileId(value.afterImageFileId);
  return title || before || after || beforeImageFileId || afterImageFileId
    ? { mode: 'compare', title, before, after, beforeImageFileId, afterImageFileId }
    : null;
}

export function normalizeAiToolIntroConfig(value: unknown): AiToolIntroConfig | undefined {
  if (!isRecord(value)) {
    return undefined;
  }
  const eyebrow = sanitizeAiToolConfigText(value.eyebrow, 30);
  const title = sanitizeAiToolConfigText(value.title, 60);
  const subtitle = sanitizeAiToolConfigText(value.subtitle, 180);
  const highlights = Array.isArray(value.highlights)
    ? value.highlights.map(normalizeHighlight).filter((item): item is AiToolIntroHighlightConfig => Boolean(item)).slice(0, 6)
    : [];
  const cases = Array.isArray(value.cases)
    ? value.cases.map(normalizeCase).filter((item): item is AiToolIntroCaseConfig => Boolean(item)).slice(0, 12)
    : [];
  const tips = Array.isArray(value.tips)
    ? value.tips.map((item) => sanitizeAiToolConfigText(item, 120)).filter(Boolean).slice(0, 6)
    : [];
  if (!eyebrow && !title && !subtitle && highlights.length === 0 && cases.length === 0 && tips.length === 0) {
    return undefined;
  }
  return {
    eyebrow,
    title,
    subtitle,
    highlights,
    cases,
    ...(tips.length ? { tips } : {}),
  };
}

export function hasAiToolIntroContent(intro?: AiToolIntroConfig): boolean {
  return Boolean(intro?.title && intro.cases.length > 0);
}

export function buildDefaultAiToolRecord(definition: AiToolDefinition): AiToolConfigRecord & { _id: string } {
  const card = getDefaultToolCardConfig(definition.toolId);
  return {
    _id: definition.toolId,
    toolId: definition.toolId,
    name: definition.name,
    category: normalizeDefinitionCategory(definition.category),
    status: getDefaultToolStatus(definition),
    runCount: 0,
    pointCost: DEFAULT_TOOL_POINT_COSTS[definition.toolId],
    trialLimit: DEFAULT_TOOL_TRIAL_LIMITS[definition.toolId],
    createdAt: DEFAULT_TOOL_BASELINE_AT,
    updatedAt: DEFAULT_TOOL_BASELINE_AT,
    builtIn: true,
    cardTitle: card.title,
    cardDescription: card.description,
    cardBadge: card.badge,
    tags: card.tags,
    icon: card.icon,
    iconImageFileId: card.iconImageFileId,
    visible: card.visible,
    sortOrder: card.sortOrder,
    outputType: card.outputType,
    intro: getDefaultToolIntroConfig(definition.toolId),
  };
}

export function toPublicAiToolView(record: AiToolConfigRecord & { _id: string }): AiToolPublicView {
  const toolId = record.toolId ?? record._id;
  const defaultCard = AI_TOOL_DEFINITIONS.find((definition) => definition.toolId === toolId)
    ? getDefaultToolCardConfig(toolId as AiToolId)
    : undefined;
  const outputType = normalizeToolOutputType(record.outputType, defaultCard?.outputType ?? 'summary');
  const intro = normalizeAiToolIntroConfig(record.intro);
  const tags = normalizeAiToolTags(record.tags, [record.cardBadge || defaultCard?.badge || ''].filter(Boolean));
  const status = normalizeToolConfigStatus(record.status);
  return {
    id: toolId,
    toolId,
    name: record.cardTitle || record.name,
    desc: record.cardDescription || defaultCard?.description || '',
    badge: tags[0] || record.cardBadge || defaultCard?.badge || (record.status === 'enabled' ? '已上线' : '接入中'),
    tags,
    icon: record.icon || defaultCard?.icon || 'AI',
    iconImageFileId: record.iconImageFileId || defaultCard?.iconImageFileId,
    status,
    enabled: status === 'enabled',
    visible: record.visible !== false && !record.deleted,
    sortOrder: normalizeAiToolSortOrder(record.sortOrder, defaultCard?.sortOrder ?? 999),
    outputType,
    pointCost: Math.max(0, Math.floor(Number(record.pointCost ?? DEFAULT_TOOL_POINT_COSTS[toolId as AiToolId] ?? 0))),
    trialLimit: Math.max(0, Math.floor(Number(record.trialLimit ?? DEFAULT_TOOL_TRIAL_LIMITS[toolId as AiToolId] ?? 0))),
    ...(hasAiToolIntroContent(intro) ? { intro } : {}),
  };
}
