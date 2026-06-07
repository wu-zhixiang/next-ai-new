export type OutputType = 'summary' | 'bullets' | 'xiaohongshu' | 'moments';
export type ToolId = 'copywriting' | 'articleSummary' | 'imageGenerate' | 'imageRepair';

export interface ToolDefinition {
  id: ToolId;
  name: string;
  desc: string;
  badge: string;
  icon: string;
  enabled: boolean;
  visible?: boolean;
  outputType: OutputType;
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
  },
  {
    id: 'imageRepair',
    name: '图片修复',
    desc: '去水印、瑕疵修复、画质增强',
    badge: '接入中',
    icon: '修',
    enabled: false,
    outputType: 'summary',
  },
];

export const VISIBLE_TOOLS = TOOLS.filter((item) => item.visible !== false);

export function getToolById(id?: string): ToolDefinition {
  return TOOLS.find((item) => item.id === id) ?? VISIBLE_TOOLS[0] ?? TOOLS[0];
}
