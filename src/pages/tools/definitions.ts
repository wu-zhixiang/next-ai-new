export type OutputType = 'summary' | 'bullets' | 'xiaohongshu' | 'moments';
export type ToolId = 'articleSummary' | 'copywriting' | 'imageGenerate' | 'imageEdit' | 'translation' | 'script';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  desc: string;
  badge: string;
  icon: string;
  enabled: boolean;
  outputType: OutputType;
}

export const TOOLS: ToolDefinition[] = [
  {
    id: 'articleSummary',
    name: '文章总结',
    desc: '长文、帖子、会议记录提炼结论',
    badge: '已上线',
    icon: '总',
    enabled: true,
    outputType: 'summary',
  },
  {
    id: 'copywriting',
    name: '文案生成',
    desc: '小红书、朋友圈内容改写',
    badge: '已上线',
    icon: '写',
    enabled: true,
    outputType: 'xiaohongshu',
  },
  {
    id: 'imageGenerate',
    name: 'AI生图',
    desc: '头像、海报、配图生成',
    badge: '接入中',
    icon: '图',
    enabled: false,
    outputType: 'summary',
  },
  {
    id: 'imageEdit',
    name: '图片编辑',
    desc: '抠图、换背景、扩图',
    badge: '接入中',
    icon: '修',
    enabled: false,
    outputType: 'summary',
  },
  {
    id: 'translation',
    name: '翻译润色',
    desc: '中英互译、语气优化',
    badge: '规划中',
    icon: '译',
    enabled: false,
    outputType: 'summary',
  },
  {
    id: 'script',
    name: '短视频脚本',
    desc: '钩子、分镜、口播稿',
    badge: '规划中',
    icon: '脚',
    enabled: false,
    outputType: 'summary',
  },
];

export function getToolById(id?: string): ToolDefinition {
  return TOOLS.find((item) => item.id === id) ?? TOOLS[0];
}
