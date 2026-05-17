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
- `seed-database`

## 5. 支付环境配置

- `pay-order` 现已接入微信支付 V2 普通商户直连统一下单。
- 需要在云函数环境变量中配置：
  - `WX_PAY_APPID`
  - `WX_PAY_MCH_ID`
  - `WX_PAY_API_KEY`
  - `WX_PAY_NOTIFY_URL`
  - `WX_PAY_SPBILL_CREATE_IP`
- `WX_PAY_NOTIFY_URL` 可使用 CloudBase HTTP 访问服务指向 `pay-notify`。

## 6. 当前手机号绑定说明

- 小程序启动时会静默调用 `user-login`，不再强制先进入登录页。
- `bind-mobile` 当前在套餐页首购时通过微信手机号授权直接触发，不单独保留绑定页面。
- 现阶段云函数通过 `openapi.phonenumber.getPhoneNumber` 直接换取真实手机号并落库。
- 前端只展示脱敏后的手机号，不再依赖占位值。
