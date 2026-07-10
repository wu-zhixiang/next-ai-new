function normalizeOutputType(value) {
  if (value === 'bullets' || value === 'xiaohongshu' || value === 'moments') {
    return value
  }
  return 'summary'
}

function buildErrorResult(toolId, title, message) {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
    structuredContent: {
      runId: '',
      status: 'failed',
      toolId,
      title,
      summary: message,
      points: [],
      outputText: message,
      createdAt: Date.now(),
    },
    runId: '',
    status: 'failed',
    toolId,
    title,
    summary: message,
    points: [],
    outputText: message,
    createdAt: Date.now(),
  }
}

async function callCloudFunction(name, data) {
  if (!wx.cloud || !wx.cloud.callFunction) {
    throw new Error('当前基础库不支持 wx.cloud.callFunction')
  }
  const result = await wx.cloud.callFunction({ name, data })
  const response = result && result.result
  if (!response) {
    throw new Error('云函数无返回结果')
  }
  if (response.code !== 0) {
    throw new Error(response.message || '云函数调用失败')
  }
  return response.data
}

module.exports = async function runTextTool(params = {}) {
  const toolId = params.toolId === 'copywriting' ? 'copywriting' : 'articleSummary'
  const outputType = normalizeOutputType(params.outputType)
  const text = String(params.text || '').trim()

  if (!text) {
    return buildErrorResult(toolId, '缺少内容', '请先粘贴需要处理的文章、帖子、会议记录或文案素材。')
  }

  try {
    const data = await callCloudFunction('run-ai-tool', {
      toolId,
      outputType,
      text,
      source: 'wechat_ai_skill',
    })
    return {
      ...data,
      isError: false,
      content: [{
        type: 'text',
        text: `已生成「${data.title || 'AI 工具结果'}」。AI 生成，仅供参考；可点击小程序卡片打开工具页继续编辑或复制。`,
      }],
      structuredContent: data,
      handoff: {
        query: `tool=${encodeURIComponent(data.toolId || toolId)}&runId=${encodeURIComponent(data.runId || '')}`,
        payload: data,
      },
    }
  } catch (error) {
    return buildErrorResult(toolId, '生成失败', error && error.message ? error.message : '请稍后重试。')
  }
}
