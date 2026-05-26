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

## 本地加载

1. 打开 Chrome 或 Edge。
2. 进入 `chrome://extensions` 或 `edge://extensions`。
3. 开启「开发者模式」。
4. 点击「加载已解压的扩展程序」。
5. 选择本目录：`operator-extension`。
6. 打开插件的「选项」，填写 API 地址和管理密钥。

## 需要的后端接口

插件默认调用以下 HTTP API：

```text
GET /operator/tasks?status=opening
POST /operator/tasks/:orderNo
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

## 安全约定

- 微信通知里不要放明文密码。
- 插件只在本机浏览器保存管理密钥。
- 后端接口必须校验 `Authorization: Bearer <token>`。
- `fulfilled` 状态应调用现有 `fulfill-membership` 逻辑，让会员开始计时。
