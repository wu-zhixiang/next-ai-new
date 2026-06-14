module.exports = async function getRunResult(params = {}) {
  const runId = String(params.runId || '').trim()
  if (!runId) {
    return {
      runId: '',
      status: 'failed',
      toolId: '',
      title: '缺少结果 ID',
      summary: '没有可查询的执行结果。',
      points: [],
      outputText: '请先执行一次 AI 工具。',
      createdAt: Date.now(),
    }
  }

  // 后续接入 get-ai-tool-run 云函数。
  return {
    runId,
    status: 'processing',
    toolId: 'articleSummary',
    title: '结果处理中',
    summary: '任务正在处理中，请稍后刷新。',
    points: [],
    outputText: '任务正在处理中。',
    createdAt: Date.now(),
  }
}
