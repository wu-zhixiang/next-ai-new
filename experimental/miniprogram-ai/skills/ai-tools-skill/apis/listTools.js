module.exports = async function listTools(params = {}) {
  const category = params.category || 'all'
  const items = [
    {
      toolId: 'articleSummary',
      name: '摘要总结',
      description: '长文、帖子、会议记录提炼结论和要点。',
      enabled: category === 'all' || category === 'text',
    },
    {
      toolId: 'copywriting',
      name: '文案生成',
      description: '把素材改写成小红书或朋友圈文案。',
      enabled: category === 'all' || category === 'text',
    },
    {
      toolId: 'imageGenerate',
      name: 'AI 生图',
      description: '头像、海报、配图生成，实验能力暂未开放。',
      enabled: false,
    },
    {
      toolId: 'imageRepair',
      name: '老照片修复',
      description: '老照片褪色、划痕、模糊修复，实验能力暂未开放。',
      enabled: false,
    },
  ].filter((item) => category === 'all' || item.enabled || category === 'image')

  return {
    items,
    isError: false,
    content: [{
      type: 'text',
      text: '已列出 AIO 当前可用 AI 工具，请点击小程序卡片进入工具列表。',
    }],
    structuredContent: { items },
    handoff: {
      query: '',
      payload: { items },
    },
  }
}
