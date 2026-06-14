# AI 工具与微信 AI 模式架构设计

更新时间：`2026-06-14`

## 目标

把当前小程序的 `AI工具` 从单一“摘要总结”扩展为可持续迭代的工具平台，并预留微信“小程序 AI 开发模式”接入能力。

目标分两层：

- 正式小程序层：用户可以在小程序内部直接打开工具、上传素材、生成结果、复制/分享、按会员权益使用。
- 微信 AI 模式层：在实验目录封装 SKILL，让微信 AI 可以通过原子接口调用小程序能力，并用原子组件展示结果卡片。

当前微信 AI 开发模式仍属于 beta/内测能力，官方提示暂未开放代码提审。因此所有 AI 模式相关代码必须放在 `experimental/miniprogram-ai/`，不能接入正式构建链路，不能随正式版本提交审核。

## 参考依据

- 官方接入指南：小程序 AI 开发模式通过小程序 MCP 暴露能力，能力由 `SKILL.md`、`mcp.json`、原子接口、原子组件组成。
- 官方 Demo：`wechat-miniprogram/ai-mode-demo` 的结构为 `skills/<skill>/SKILL.md`、`mcp.json`、`index.js`、`apis/`、`components/`。
- Demo 关键模式：
  - `SKILL.md` 写业务流程、调用顺序、禁止场景、数据来源。
  - `mcp.json` 声明原子接口的 `inputSchema` / `outputSchema`，并通过 `_meta.ui.componentPath` 绑定卡片组件。
  - `index.js` 使用 `wx.modelContext.createSkill('skills/<skill>')` 创建 skill，并 `registerAPI` 注册每个原子接口。

## 当前项目基础

现有能力：

- 小程序页面：
  - `src/pages/tools/index.tsx`：AI 工具列表。
  - `src/pages/tool-detail/index.tsx`：工具工作台，当前承载摘要总结、文件/图片素材、结果展示。
- 工具定义：
  - `src/pages/tools/definitions.ts`：`copywriting`、`articleSummary`、`imageGenerate`、`imageRepair`。
- 云函数：
  - `cloudfunctions/summarize-ai-tool/index.ts`：摘要、要点、小红书、朋友圈文案生成。
- 会员/额度：
  - 当前前端用本地 `ai_tool_daily_usage` 做每日免费 1 次限制。
  - 会员状态来自 `get-member-home`。

需要补齐：

- 后端统一工具执行入口。
- 后端用量与历史记录。
- 文件素材标准化存储。
- 工具配置与模板配置。
- 微信 AI 模式实验 SKILL。

## 总体架构

```text
用户
  │
  ├─ 正式小程序 UI
  │   ├─ AI 工具列表
  │   ├─ 工具工作台
  │   ├─ 历史结果
  │   └─ 会员/广告/额度入口
  │
  ├─ 微信 AI 对话入口（实验）
  │   └─ SKILL 原子接口 + 原子组件
  │
  ▼
工具服务层
  ├─ run-ai-tool              # 统一执行入口
  ├─ get-ai-tool-config       # 工具配置/模板
  ├─ list-ai-tool-runs        # 历史记录
  ├─ get-ai-tool-run          # 单次结果
  └─ summarize-ai-tool        # 旧入口，逐步兼容迁移
  │
  ▼
能力适配层
  ├─ text-generation adapter
  ├─ vision-understanding adapter
  ├─ image-generation adapter
  ├─ image-editing adapter
  └─ content-safety adapter
  │
  ▼
云数据库 / 云存储
  ├─ ai_tool_runs
  ├─ ai_tool_assets
  ├─ ai_tool_usage_daily
  ├─ ai_tool_templates
  └─ cloud storage
```

## 工具分层

### 1. 工具定义层

工具定义必须同时服务正式 UI 和微信 AI SKILL。

```ts
type AiToolId =
  | 'articleSummary'
  | 'copywriting'
  | 'imageGenerate'
  | 'imageRepair';

interface AiToolDefinition {
  toolId: AiToolId;
  name: string;
  description: string;
  category: 'text' | 'image' | 'office';
  enabled: boolean;
  inputModes: Array<'text' | 'file' | 'image'>;
  outputModes: Array<'summary' | 'bullets' | 'xiaohongshu' | 'moments' | 'image'>;
  memberOnly?: boolean;
  dailyFreeLimit: number;
}
```

### 2. 工具执行层

统一云函数：`run-ai-tool`

请求：

```ts
interface RunAiToolInput {
  toolId: AiToolId;
  outputType?: 'summary' | 'bullets' | 'xiaohongshu' | 'moments' | 'image';
  text?: string;
  assetIds?: string[];
  inlineImageDataUrl?: string;
  options?: Record<string, unknown>;
  source?: 'miniapp' | 'wechat_ai_skill';
}
```

返回：

```ts
interface RunAiToolResult {
  runId: string;
  status: 'succeeded' | 'failed' | 'processing';
  toolId: AiToolId;
  title: string;
  summary?: string;
  points?: string[];
  outputText?: string;
  outputImages?: Array<{
    fileId: string;
    url?: string;
    width?: number;
    height?: number;
  }>;
  usage: {
    charged: boolean;
    freeUsed: boolean;
    model?: string;
  };
  createdAt: number;
}
```

错误语义：

- `UNAUTHENTICATED`：未登录。
- `TOOL_DISABLED`：工具未开放。
- `QUOTA_EXCEEDED`：免费额度用完且无会员/广告解锁。
- `INVALID_INPUT`：输入为空、文件格式不支持、图片过大。
- `MODEL_FAILED`：模型调用失败。
- `CONTENT_REJECTED`：内容安全拦截。

### 3. 能力适配层

不要在页面或 SKILL 里直接写模型调用逻辑。统一封装：

- `generateText`：摘要、文案、要点。
- `understandImage`：图片 OCR/理解，当前摘要工具图片输入可归到这里。
- `generateImage`：头像、海报、配图。
- `editImage`：去水印、修复、背景替换。
- `moderateContent`：输入输出安全审核。

这样以后从云开发 AI 切到混元、DeepSeek、OpenAI 兼容接口或其他模型时，不影响页面和 SKILL。

## 数据模型

### ai_tool_runs

记录每次执行，支撑历史、计费、排错。

```ts
interface AiToolRunRecord {
  _id?: string;
  userId: string;
  openid: string;
  toolId: AiToolId;
  outputType?: string;
  source: 'miniapp' | 'wechat_ai_skill';
  status: 'processing' | 'succeeded' | 'failed';
  inputDigest: string;
  assetIds: string[];
  title?: string;
  summary?: string;
  points?: string[];
  outputText?: string;
  outputImages?: Array<{ fileId: string; width?: number; height?: number }>;
  modelProvider?: string;
  modelName?: string;
  errorCode?: string;
  errorMessage?: string;
  createdAt: number;
  updatedAt: number;
}
```

### ai_tool_assets

记录用户上传素材，原文件进入云存储。

```ts
interface AiToolAssetRecord {
  _id?: string;
  userId: string;
  fileId: string;
  fileName: string;
  fileType: string;
  fileKind: 'text' | 'document' | 'image';
  size: number;
  extractedText?: string;
  createdAt: number;
}
```

### ai_tool_usage_daily

后端额度记录，替代当前前端本地 `ai_tool_daily_usage`。

```ts
interface AiToolUsageDailyRecord {
  _id?: string;
  userId: string;
  date: string; // YYYY-MM-DD
  freeUsed: number;
  adUnlocked: number;
  memberUsed: number;
  updatedAt: number;
}
```

### ai_tool_templates

模板库，服务正式页面和微信 AI 意图引导。

```ts
interface AiToolTemplateRecord {
  _id?: string;
  toolId: AiToolId;
  title: string;
  prompt: string;
  outputType: string;
  sort: number;
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
}
```

## 正式小程序使用流程

### 文本类工具

```text
AI 工具列表
  → 工具工作台
  → 输入文本/粘贴内容/添加文件或图片
  → run-ai-tool
  → 展示结果卡片
  → 复制/分享/保存历史
```

### 图片类工具

```text
AI 工具列表
  → 图片生成/图片修复工作台
  → 输入 prompt 或上传图片
  → run-ai-tool 创建任务
  → processing 状态轮询
  → 展示图片结果
  → 保存相册/分享/再次编辑
```

### 权益规则

- 游客/未登录：先静默登录；需要写入历史或扣额度时必须有 `userId`。
- 非会员：每日免费次数走后端 `ai_tool_usage_daily`。
- 会员：走会员权益，不消耗免费次数。
- 广告解锁：广告完成后给一次临时执行资格，仍需后端记录，避免只靠前端状态。

## 微信 AI 模式接入设计

实验目录：

```text
experimental/miniprogram-ai/
  README.md
  skills/
    ai-tools-skill/
      SKILL.md
      mcp.json
      index.js
      apis/
        listTools.js
        runTextTool.js
        getRunResult.js
      components/
        tool-list-card/
        tool-result-card/
        tool-error-card/
```

### Skill 1：ai-tools-skill

第一期只开放低风险工具：

- 摘要总结。
- 要点提炼。
- 小红书/朋友圈文案。

不开放：

- 账号密码查看。
- 邮箱验证码。
- App Store 账号池。
- 运营插件接口。
- 订单开通/支付。

### 原子接口

#### listTools

用途：用户询问“有什么 AI 工具”“能帮我总结吗”时返回可用工具卡片。

输入：

```json
{
  "type": "object",
  "properties": {
    "category": {
      "type": "string",
      "enum": ["text", "image", "all"]
    }
  }
}
```

输出：

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "toolId": { "type": "string" },
          "name": { "type": "string" },
          "description": { "type": "string" },
          "enabled": { "type": "boolean" }
        }
      }
    }
  }
}
```

绑定组件：`components/tool-list-card/index`

#### runTextTool

用途：执行摘要、要点、文案生成。

调用前置条件：

- 用户已经提供明确文本内容，或从卡片/半屏页面传入了内容。
- `toolId` 必须来自 `listTools` 返回或官方枚举。
- 用户没有提供内容时禁止编造，应先反问用户粘贴内容。

输入：

```json
{
  "type": "object",
  "properties": {
    "toolId": {
      "type": "string",
      "enum": ["articleSummary", "copywriting"]
    },
    "outputType": {
      "type": "string",
      "enum": ["summary", "bullets", "xiaohongshu", "moments"]
    },
    "text": {
      "type": "string",
      "description": "用户提供的待处理文本，禁止编造。"
    }
  },
  "required": ["toolId", "text"]
}
```

输出：复用 `RunAiToolResult` 的文本字段。

绑定组件：`components/tool-result-card/index`

#### getRunResult

用途：查询异步任务结果，给图片工具和长任务预留。

输入：

```json
{
  "type": "object",
  "properties": {
    "runId": { "type": "string" }
  },
  "required": ["runId"]
}
```

### SKILL.md 业务铁律

必须写入：

- 没有用户输入内容时，禁止调用 `runTextTool`。
- 禁止编造文件内容、链接内容、图片文字。
- 对图片/文件看不清时必须说明不确定。
- 成功返回且绑定组件时必须展示卡片，不要把卡片内容全部用纯文本展开。
- 生成内容必须标注“AI 生成，仅供参考”。
- 涉及医疗、法律、金融、账号密码、验证码、支付、订单开通，一律不在 AI SKILL 中处理。

## 正式构建与实验构建隔离

正式版本：

- 只包含 `src/`、`cloudfunctions/`、正式页面配置。
- 不引用 `experimental/miniprogram-ai`。
- 不在 `app.config` / `app.json` 注册 `agent.skills`。

实验版本：

- 单独分支或单独构建配置。
- 参考官方 demo 注册 `skills/ai-tools-skill`。
- 只用于开发者工具 Nightly / AI 开发模式调试。

## 实施计划

### Phase 1：统一工具后端

目标：把 `summarize-ai-tool` 能力升级为 `run-ai-tool`，正式小程序仍可使用。

任务：

- 新增 `run-ai-tool` 云函数。
- 新增 `ai_tool_runs`、`ai_tool_usage_daily` 数据模型。
- 将当前摘要总结逻辑迁入工具服务层。
- 保留 `summarize-ai-tool` 兼容旧页面，内部可转调 `run-ai-tool`。

验收：

- 摘要总结、小红书、朋友圈、要点输出正常。
- 非会员每日免费次数由后端控制。
- 结果写入历史记录。

### Phase 2：小程序工具平台化

目标：用户在小程序内有完整 AI 工具使用体验。

任务：

- 工具列表读取后端配置。
- 工具详情页支持历史记录。
- 文件/图片素材上传走云存储和 `ai_tool_assets`。
- 修复当前 `tool-detail` 重复 `imageDataUrl` 属性导致的 TypeScript 错误。

验收：

- 用户可上传常用文件和图片。
- 删除素材后重新添加不会丢状态。
- 生成结果可复制、分享、从历史重新打开。

### Phase 3：图片工具

目标：上线 `imageGenerate` 和 `imageRepair`。

任务：

- 增加图片生成/编辑 adapter。
- 异步任务状态：`processing/succeeded/failed`。
- 结果图片进入云存储。
- 接入内容安全审核。

验收：

- 文生图、上传图编辑能跑通。
- 失败可重试，结果可保存。
- 图片大小和格式有明确提示。

### Phase 4：微信 AI 模式实验 SKILL

目标：符合微信 AI 开发模式目录与接口要求。

任务：

- 新增 `experimental/miniprogram-ai/skills/ai-tools-skill/`。
- 编写 `SKILL.md`。
- 编写 `mcp.json`。
- 编写 `index.js` 注册原子接口。
- 编写 `apis/listTools.js`、`apis/runTextTool.js`、`apis/getRunResult.js`。
- 编写 `components/tool-list-card` 和 `components/tool-result-card`。

验收：

- 微信开发者工具 AI 模式可识别 Skill。
- 对话中“帮我总结这段内容”能调用 `runTextTool`。
- 返回结果以卡片展示。

### Phase 5：审核与上线策略

目标：不影响正式小程序发布。

任务：

- 正式分支不包含 AI 模式注册。
- 实验分支保留 `experimental/miniprogram-ai`。
- 在微信开放正式提审前，不把 AI 模式代码合入正式构建。

验收：

- 正式版构建产物不包含 `agent.skills`。
- 实验版可独立调试。

## 安全与合规边界

必须做到：

- 所有用户输入在云函数边界校验。
- 输出标注 AI 生成。
- 用户素材不要暴露给其他用户。
- 历史记录只按当前 `openid/userId` 查询。
- 账号密码、验证码、订单开通、运营插件能力不进入微信 AI SKILL。

禁止：

- 在 SKILL 中返回 ChatGPT 账号密码。
- 在 SKILL 中读取邮箱验证码。
- 在 SKILL 中操作 App Store 账号池。
- 在 SKILL 中发起支付或订单开通。
- 把 AI 模式实验代码接入正式审核版本。

## 当前最小下一步

建议先做两件事：

1. 修复 `src/pages/tool-detail/index.tsx` 当前重复 `imageDataUrl` 字段的 TypeScript 错误。
2. 新建 `run-ai-tool` 云函数和 `ai_tool_runs` 记录，让摘要总结先走统一工具架构。

完成后再开始 `experimental/miniprogram-ai/skills/ai-tools-skill` 的 SKILL 文件与原子接口。
