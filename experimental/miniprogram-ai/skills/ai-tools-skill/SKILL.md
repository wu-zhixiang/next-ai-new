# ai-tools-skill AIO AI 工具场景

## 业务目标

让微信 AI 可以调用 AIO 小程序内的低风险 AI 工具能力，优先支持：

- 摘要总结
- 要点提炼
- 小红书文案
- 朋友圈文案

本 SKILL 仅用于微信小程序 AI 开发模式实验，不进入正式审核版本。

## 业务流程

```text
用户意图
  │
  ├─ 询问可用 AI 工具
  │    └─ listTools → 工具列表卡片
  │
  ├─ 提供文本并要求总结/提炼/改写
  │    └─ runTextTool → 工具结果卡片
  │
  └─ 查询某次生成结果
       └─ getRunResult → 工具结果卡片
```

## 原子接口依赖关系

| 接口 | 作用 | 组件 | 前置条件 |
| --- | --- | --- | --- |
| listTools | 返回可用 AI 工具 | tool-list-card | 无 |
| runTextTool | 执行文本类工具 | tool-result-card | 用户提供了明确文本内容 |
| getRunResult | 查询执行结果 | tool-result-card | 已有 runId |

## 调用规则

### 1. 数据来源

- `toolId` 必须来自 `listTools` 返回或 `mcp.json` 枚举。
- `text` 必须来自用户原话、用户粘贴内容或小程序页面传入内容。
- 禁止编造用户没有提供的文章、文件、链接或图片内容。
- 如果用户只说“帮我总结”但没有提供内容，必须先反问用户粘贴内容。

### 2. 输出形态

- 成功返回且绑定组件时，必须展示结果卡片。
- Agent 可以附加一句简短引导，例如“已生成摘要，可以复制使用”。
- 禁止把卡片内容全部用 markdown 长列表重复展开。
- 生成内容必须提示“AI 生成，仅供参考”。

### 3. 禁止场景

本 SKILL 禁止处理：

- ChatGPT 账号密码查看。
- 邮箱验证码。
- Apple Store 账号池。
- 运营插件接口。
- 订单开通、支付、退款。
- 医疗、法律、金融等高风险专业建议。

### 4. 安全降级

- 输入为空：反问用户补充内容。
- 文本过长：提示用户拆分。
- 模型失败：返回错误卡片，建议稍后重试。
- 额度不足：展示额度提示，引导回小程序会员中心。

## 用户意图分流

- “有什么 AI 工具” → `listTools`
- “帮我总结这段” + 有文本 → `runTextTool`，`outputType=summary`
- “提炼要点” + 有文本 → `runTextTool`，`outputType=bullets`
- “改成小红书文案” + 有文本 → `runTextTool`，`outputType=xiaohongshu`
- “改成朋友圈” + 有文本 → `runTextTool`，`outputType=moments`
- “查看刚才结果” + 有 `runId` → `getRunResult`
