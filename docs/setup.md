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
- `pay-notify`
- `fulfill-membership`
- `retry-order`
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

## 7. 当前手机号绑定说明

- 小程序启动时会静默调用 `user-login`，不再强制先进入登录页。
- `bind-mobile` 当前在套餐页首购时通过微信手机号授权直接触发，不单独保留绑定页面。
- 现阶段云函数通过 `openapi.phonenumber.getPhoneNumber` 直接换取真实手机号并落库。
- 前端只展示脱敏后的手机号，不再依赖占位值。
