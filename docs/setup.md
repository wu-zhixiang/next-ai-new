# 本地开发准备

## 1. 安装依赖

```bash
npm install
```

## 2. 初始化云开发

- 创建 CloudBase 环境
- 在微信开发者工具里勾选云开发
- 创建以下集合：
  - `users`
  - `member_plans`
  - `memberships`
  - `orders`
  - `deliveries`
  - `renew_contracts`
  - `reminder_logs`
  - `audit_logs`

## 3. 初始化套餐数据

优先使用云函数 `seed-database` 初始化套餐数据：

1. 上传 `seed-database`
2. 在云开发控制台执行一次：

```json
{
  "dryRun": false
}
```

如需人工导入，也可以使用 [database-seed.json](/Users/qitmac001343/Desktop/ai-business/gpt-pay/docs/database-seed.json) 中的 `member_plans`。

## 4. 上传云函数

第一阶段需要上传：

- `user-login`
- `bind-mobile`
- `list-member-plans`
- `get-member-home`
- `create-order`
- `pay-order`
- `get-pay-result`
- `list-ai-news`
- `get-ai-news-detail`
- `pay-notify`
- `fulfill-membership`
- `retry-order`
- `reset-database`
- `operator-api`
- `send-renew-reminders`
- `summarize-ai-tool`
- `seed-database`

## 5. 支付环境配置

- `pay-order` 现已接入小程序官方虚拟支付，会员购买订单默认走 `wx.requestVirtualPayment`。
- 需要在云函数环境变量中配置：
  - `WX_PAY_APPID`
  - `WX_APP_SECRET`
  - `WX_VIRTUAL_PAY_OFFER_ID`
  - `WX_VIRTUAL_PAY_APP_KEY`
  - `WX_VIRTUAL_PAY_ENV`，沙箱填 `1`，现网填 `0`
  - `WX_VIRTUAL_PAY_PRODUCT_ID`，或按套餐配置 `WX_VIRTUAL_PAY_PRODUCT_ID_GO`、`WX_VIRTUAL_PAY_PRODUCT_ID_PLUS`
- 小程序后台虚拟支付回调 URL 指向 `pay-notify` 的 HTTP 访问服务地址。

## 6. 运营通知配置

支付成功后，后端会把订单更新为“开通中”，并尝试发送一条运营通知。通知只包含订单、套餐、金额、支付时间和注册邮箱；密码仍通过运营插件查看，不通过通知通道发送。

按实际使用的通道配置以下任意一个环境变量即可：

- `WEWORK_BOT_WEBHOOK`
  企业微信群机器人 Webhook 地址，推荐优先使用。
- `PUSHPLUS_TOKEN`
  PushPlus 推送 token。
- `SERVERCHAN_SENDKEY`
  Server酱 SendKey。
- `OPERATOR_NOTIFY_ENABLED`
  可选。填 `0` 时关闭运营通知。

通知逻辑在公共支付成功链路中触发，因此 `pay-order` 查询支付成功、`pay-notify` 微信回调成功都会覆盖。通知失败不会阻塞订单支付状态更新，失败原因会写入云函数日志。

## 7. 运营插件接口配置

运营插件通过 `operator-api` 云函数读取待开通订单、查看账号密码、把订单标记为处理中或已开通，并上传 AI 资讯文章。

需要给 `operator-api` 配置：

- `OPERATOR_API_TOKEN`
  运营接口访问密钥，建议使用 32 位以上随机字符串。
- `AI_ACCOUNT_SECRET`
  必须与 `save-ai-account` 使用的密码加密密钥一致，否则运营插件无法解密用户提交的账号密码。
- `TCB_AI_NEWS_META_ENABLED`
  可选。设置为 `true` 后，运营插件上传 Markdown 资讯时会优先通过云开发 AI 成长计划生成标题和摘要。
- `TCB_AI_API_KEY`
  可选。云开发 AI API Key。
- `TCB_AI_BASE_URL`
  可选。云开发 AI OpenAI 兼容 Base URL，例如 `https://<ENV_ID>.api.tcloudbasegateway.com/v1/ai/hunyuan-v3`。
- `TCB_AI_MODEL`
  可选。标题摘要生成模型，默认 `hy3-preview`。未配置或 AI 调用失败时，会从 Markdown 正文自动提取标题和摘要。

部署 `operator-api` 后，在云开发控制台开启 HTTP 访问服务。插件设置页填写：

- `API Base URL`
  填 `operator-api` 的 HTTP 访问地址，不需要自己追加 `/operator/tasks`。
- `运营密钥`
  填与 `OPERATOR_API_TOKEN` 完全一致的值。

## 8. AI 工具配置

`AI工具` 页第一版已接入 `文章总结`，需要部署：

- `summarize-ai-tool`

云函数环境变量：

- `TCB_AI_API_KEY`
  云开发 AI API Key。
- `TCB_AI_BASE_URL`
  云开发 AI OpenAI 兼容 Base URL，例如 `https://<ENV_ID>.api.tcloudbasegateway.com/v1/ai/hunyuan-v3`。
- `TCB_AI_MODEL`
  可选，默认 `hy3-preview`。

小程序前端广告配置：

- `TARO_APP_AI_TOOL_REWARD_AD_UNIT_ID`
  激励视频广告位 ID。未配置时，免费次数用完后会提示广告位待配置，不会继续调用工具。

## 9. 当前手机号绑定说明

- 小程序启动时会静默调用 `user-login`，不再强制先进入登录页。
- `bind-mobile` 当前在套餐页首购时通过微信手机号授权直接触发，不单独保留绑定页面。
- 现阶段云函数通过 `openapi.phonenumber.getPhoneNumber` 直接换取真实手机号并落库。
- 前端只展示脱敏后的手机号，不再依赖占位值。

## 9.1 前端远程开关

`get-app-config` 云函数会读取数据库集合 `app_config` 下的 `client` 文档，用于控制线上前端行为。

当前支持字段：

```json
{
  "_id": "client",
  "enableNewsAuthModal": false
}
```

- `enableNewsAuthModal: false`：用户首次进入 AI 资讯页不展示昵称头像授权浮层。
- 未创建集合、未创建文档或字段缺失时，默认按 `true` 处理，保持展示授权浮层。

## 10. 续费提醒

当前续费采用“用户手动续费 + 到期前 2 天提醒”：

- 支付成功后，小程序会自动弹出续费提醒授权。
- 会员剩余时间小于等于 2 天时，会员中心卡片按钮展示为“立即续费”。
- `send-renew-reminders` 云函数负责扫描 2 天内到期会员，并发送订阅消息。

需要配置：

- 前端构建环境变量 `TARO_APP_RENEW_REMINDER_TEMPLATE_ID`
  用于 `wx.requestSubscribeMessage` 申请用户授权。
- 云函数环境变量 `WX_RENEW_REMINDER_TEMPLATE_ID`
  用于 `send-renew-reminders` 发送订阅消息。

建议在云开发定时触发器中每天执行一次 `send-renew-reminders`。

## 11. 清理测试数据

使用 `reset-database` 云函数清除测试业务数据，并重新初始化会员套餐。为避免误删，必须传确认字符串。

先 dry run 看影响范围：

```json
{
  "confirm": "RESET_TEST_DATABASE",
  "dryRun": true
}
```

正式清理默认会清除以下集合：

- `memberships`
- `orders`
- `deliveries`
- `invite_relations`
- `points_ledger`
- `email_verification_codes`
- `reminder_logs`
- `audit_logs`

同时会把 `users.pointsBalance` 重置为 `0`，并重新初始化 `member_plans` 中的 GO / PLUS 套餐：

```json
{
  "confirm": "RESET_TEST_DATABASE"
}
```

如果连测试用户也要清除：

```json
{
  "confirm": "RESET_TEST_DATABASE",
  "includeUsers": true
}
```

如果要先清空套餐表再重建：

```json
{
  "confirm": "RESET_TEST_DATABASE",
  "includeMemberPlans": true
}
```

## 12. 废弃订单自动清理

废弃订单保留 7 天，超过 7 天后从 `orders` 集合删除。

废弃订单包含：

- `payStatus` 为 `closed` 或 `failed` 的订单。
- `payStatus` 为 `pending`，且已超过支付有效期的待支付订单。

当前有两种清理入口：

- 用户进入服务记录页时，`list-orders` 会顺手清理该用户 7 天前的废弃订单。
- `cleanup-abandoned-orders` 云函数用于全量清理所有用户废弃订单，建议在云开发控制台配置定时触发，每天执行一次。

需要部署：

- `list-orders`
- `cleanup-abandoned-orders`
