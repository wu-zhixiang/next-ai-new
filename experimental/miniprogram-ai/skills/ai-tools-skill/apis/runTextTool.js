function normalizeOutputType(value) {
  if (value === 'bullets' || value === 'xiaohongshu' || value === 'moments') {
    return value
  }
  return 'summary'
}

module.exports = async function runTextTool(params = {}) {
  const toolId = params.toolId === 'copywriting' ? 'copywriting' : 'articleSummary'
  const outputType = normalizeOutputType(params.outputType)
  const text = String(params.text || '').trim()

  if (!text) {
    return {
      runId: '',
      status: 'failed',
      toolId,
      title: '缺少内容',
      summary: '请先粘贴需要处理的文章、帖子、会议记录或文案素材。',
      points: [],
      outputText: '请先提供需要处理的内容。',
      createdAt: Date.now(),
    }
  }

  // 后续接入正式 run-ai-tool 云函数。当前实验骨架只定义接口契约。
  return {
    runId: `demo_${Date.now()}`,
    status: 'succeeded',
    toolId,
    title: outputType === 'bullets' ? '要点总结' : toolId === 'copywriting' ? '文案生成' : '摘要总结',
    summary: text.slice(0, 120),
    points: [text.slice(0, 48)].filter(Boolean),
    outputText: text.slice(0, 500),
    createdAt: Date.now(),
  }
}
