export type OutputType = 'summary' | 'bullets' | 'xiaohongshu' | 'moments';
export type ToolId = 'copywriting' | 'articleSummary' | 'imageGenerate' | 'imageRepair';

export interface ToolIntroHighlight {
  title: string;
  desc: string;
}

export interface ToolIntroCase {
  title: string;
  before: string;
  after: string;
}

export interface ToolIntroDefinition {
  eyebrow: string;
  title: string;
  subtitle: string;
  highlights: ToolIntroHighlight[];
  cases: ToolIntroCase[];
  tips?: string[];
}

export interface ToolDefinition {
  id: ToolId;
  name: string;
  desc: string;
  badge: string;
  icon: string;
  enabled: boolean;
  visible?: boolean;
  outputType: OutputType;
  intro?: ToolIntroDefinition;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: 'copywriting',
    name: '文案生成',
    desc: '小红书、朋友圈文案改写',
    badge: '已上线',
    icon: '写',
    enabled: true,
    visible: false,
    outputType: 'xiaohongshu',
  },
  {
    id: 'articleSummary',
    name: '摘要总结',
    desc: '长文、帖子、会议记录提炼结论',
    badge: '已上线',
    icon: '总',
    enabled: true,
    outputType: 'summary',
  },
  {
    id: 'imageGenerate',
    name: 'AI生图',
    desc: '头像、海报、配图生成',
    badge: '接入中',
    icon: '图',
    enabled: false,
    outputType: 'summary',
    intro: {
      eyebrow: 'AI生图',
      title: '把一句想法变成可用图片',
      subtitle: '适合快速生成头像、社交配图、活动海报和内容封面。先选清楚用途，再进入工具页提交提示词。',
      highlights: [
        { title: '用途导向', desc: '围绕头像、封面、海报、商品图等实际场景组织提示词。' },
        { title: '参考素材', desc: '后续可结合参考图做风格延展、布局复刻和局部修改。' },
        { title: '模型分层', desc: '标准模型走低成本生成，高级模型按次数或点数控制成本。' },
      ],
      cases: [
        { title: '小红书封面', before: '只有文章标题和主题关键词', after: '生成统一风格封面，便于直接发布' },
        { title: '活动海报', before: '一句活动卖点和时间地点', after: '输出带明确视觉主体的海报草图' },
        { title: '头像方案', before: '描述人物气质和职业场景', after: '生成多种头像风格方向' },
      ],
      tips: ['主体、场景、风格、尺寸越明确，出图越稳定。', '涉及品牌、人物或版权素材时，请确保你有使用授权。'],
    },
  },
  {
    id: 'imageRepair',
    name: '老照片修复',
    desc: '老照片褪色、划痕、模糊修复',
    badge: '接入中',
    icon: '修',
    enabled: false,
    outputType: 'summary',
    intro: {
      eyebrow: '老照片修复',
      title: '让旧照片重新清晰',
      subtitle: '面向泛黄、褪色、划痕、折痕和低清扫描件，优先恢复照片可读性和人物细节。',
      highlights: [
        { title: '修复瑕疵', desc: '处理划痕、折痕、污点和扫描噪点，让画面更干净。' },
        { title: '增强清晰度', desc: '改善低清、轻微模糊和压缩损失，保留原照片质感。' },
        { title: '自然还原', desc: '避免过度美化，把重点放在真实照片的色彩和细节恢复。' },
      ],
      cases: [
        { title: '泛黄老照片', before: '照片整体发黄、对比度低', after: '肤色和背景更自然，人物轮廓更清楚' },
        { title: '折痕划痕', before: '画面有明显折线、白痕或污点', after: '瑕疵区域被修补，画面连续性更好' },
        { title: '低清扫描件', before: '老照片翻拍后偏糊、细节弱', after: '面部和服饰细节更容易辨认' },
      ],
      tips: ['请上传你本人拥有或已获授权处理的照片。', '严重缺失的人脸或背景无法保证完全还原，只能做合理修复。'],
    },
  },
];

export const VISIBLE_TOOLS = TOOLS.filter((item) => item.visible !== false);

export function getToolById(id?: string): ToolDefinition {
  return TOOLS.find((item) => item.id === id) ?? VISIBLE_TOOLS[0] ?? TOOLS[0];
}

export function hasToolIntro(tool: ToolDefinition): boolean {
  return Boolean(tool.intro?.title && tool.intro.cases.length > 0);
}

export function getToolDetailUrl(toolId: ToolId): string {
  return `/pages/tool-detail/index?tool=${encodeURIComponent(toolId)}`;
}

export function getToolIntroUrl(toolId: ToolId): string {
  return `/pages/tool-intro/index?tool=${encodeURIComponent(toolId)}`;
}

export function getToolEntryUrl(tool: ToolDefinition): string {
  return hasToolIntro(tool) ? getToolIntroUrl(tool.id) : getToolDetailUrl(tool.id);
}
