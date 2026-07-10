function buildErrorResult(title, message) {
  return {
    isError: true,
    content: [{ type: 'text', text: message }],
    structuredContent: {
      runId: '',
      status: 'failed',
      toolId: '',
      title,
      summary: message,
      points: [],
      outputText: message,
      createdAt: Date.now(),
    },
    runId: '',
    status: 'failed',
    toolId: '',
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

module.exports = async function getRunResult(params = {}) {
  const runId = String(params.runId || '').trim()
  if (!runId) {
    return buildErrorResult('缺少结果 ID', '请先执行一次 AI 工具。')
  }

  try {
    const data = await callCloudFunction('get-ai-tool-run', { runId })
    return {
      ...data,
      isError: data.status === 'failed',
      content: [{
        type: 'text',
        text: data.status === 'processing'
          ? '任务正在处理中，请稍后刷新。'
          : `已查询到「${data.title || 'AI 工具结果'}」。AI 生成，仅供参考。`,
      }],
      structuredContent: data,
      handoff: {
        query: `tool=${encodeURIComponent(data.toolId || 'articleSummary')}&runId=${encodeURIComponent(data.runId || runId)}`,
        payload: data,
      },
    }
  } catch (error) {
    return buildErrorResult('查询失败', error && error.message ? error.message : '请稍后重试。')
  }
}
