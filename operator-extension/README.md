# Open AI 资讯会员运营助手

这是一个 Chrome/Edge Manifest V3 浏览器插件，用于处理小程序里已经支付、等待人工开通的会员订单。

## 当前能力

- 查看待开通订单列表
- 展示订单号、套餐、金额、支付时间
- 一键复制用户注册账号
- 一键复制用户注册密码
- 明文获取当前订单邮箱最近一次验证码，并自动复制
- 一键打开 ChatGPT 官网
- 标记处理中
- 标记已开通
- 上传真实 AI 资讯到小程序首页
- 上传头图和 Markdown 正文，生成小程序资讯详情页

## 本地加载

1. 打开 Chrome 或 Edge。
2. 进入 `chrome://extensions` 或 `edge://extensions`。
3. 开启「开发者模式」。
4. 点击「加载已解压的扩展程序」。
5. 选择本目录：`operator-extension`。
6. 打开插件的「选项」，填写 API 地址和管理密钥。

插件图标会打开浏览器 Side Panel 侧边栏。侧边栏不会因为点击网页其他位置而关闭，适合一边浏览 X / ChatGPT，一边复制账号、验证码和上传资讯。

## 需要的后端接口

插件默认调用以下 HTTP API：

```text
GET /operator/tasks?status=opening
POST /operator/tasks/:orderNo
POST /operator/news/cover
POST /operator/news
```

当前项目已提供 `operator-api` 云函数。部署后，在插件设置页中：

- `API Base URL` 填 `operator-api` 的 HTTP 访问地址。
- `运营密钥` 填云函数环境变量 `OPERATOR_API_TOKEN` 的值。

`operator-api` 还需要配置 `AI_ACCOUNT_SECRET`，并且必须与小程序保存账号密码时使用的密钥一致。

建议后端返回格式：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "tasks": [
      {
        "orderNo": "ORDxxx",
        "productName": "Open AI 资讯会员",
        "planName": "AI资讯GO会员",
        "amount": 66.99,
        "paidAt": 1779000000000,
        "email": "demo@mraclpivot.com",
        "password": "Demo@123456"
      }
    ]
  }
}
```

标记状态请求：

```json
{
  "status": "fulfilled",
  "note": "已人工开通"
}
```

`status` 支持：

```text
processing
fulfilled
failed
```

处理含义：

- `processing`：只标记订单正在人工处理。
- `fulfilled`：调用会员开通逻辑，会员开始计时。
- `failed`：标记开通失败，保留备注供排查。

## 上传 AI 资讯

插件「资讯」面板支持手动上传真实资讯。推荐流程：

1. 打开 X、官方博客或技术文章页面。
2. 点击「读取当前页」。如果当前页是 X 帖子页，会自动回填来源、作者、浏览量、点赞、转发和评论数。
3. 用 Grok / GPT Plus 将原文整理成公众号风格 Markdown 正文。
4. 上传一张符合文章内容的头图：可点击选择本地文件，也可复制网页图片后点击头图区域按 `Cmd/Ctrl + V` 粘贴。插件会先把头图上传到云存储，再发布资讯正文。
5. 检查自动读取的数据，手动补标签或修正互动数。
6. 点击「上传发布」。

读取 X 页面数据依赖浏览器扩展的 `activeTab` 和 `scripting` 权限。更新插件文件后，需要在浏览器扩展管理页重新加载一次插件。

上传后 `operator-api` 会优先通过腾讯云 AI 能力生成标题和摘要；如果云端 AI 未配置，会从 Markdown 正文中自动提取标题和摘要兜底。小程序 `AI资讯` 页会通过 `list-ai-news` 云函数读取并按热度展示，用户点击卡片进入原生详情页阅读 Markdown 文章。

如需开启腾讯云 AI 生成标题和摘要，给 `operator-api` 配置：

```text
TCB_AI_NEWS_META_ENABLED=true
TCB_AI_API_KEY=云开发控制台创建的 API Key
TCB_AI_BASE_URL=https://<ENV_ID>.api.tcloudbasegateway.com/v1/ai/hunyuan-v3
TCB_AI_MODEL=hy3-preview
```

## 安全约定

- 微信通知里不要放明文密码。
- 插件只在本机浏览器保存管理密钥。
- 后端接口必须校验 `Authorization: Bearer <token>`。
- `fulfilled` 状态应调用现有 `fulfill-membership` 逻辑，让会员开始计时。
