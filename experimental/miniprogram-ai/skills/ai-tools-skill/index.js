// 微信小程序 AI 开发模式实验代码。
// 不要接入正式小程序构建或审核版本。

const listTools = require('./apis/listTools.js')
const runTextTool = require('./apis/runTextTool.js')
const getRunResult = require('./apis/getRunResult.js')

const skill = wx.modelContext.createSkill('skills/ai-tools-skill')

skill.registerAPI('listTools', listTools)
skill.registerAPI('runTextTool', runTextTool)
skill.registerAPI('getRunResult', getRunResult)

console.log('[ai-tools-skill] APIs registered')
