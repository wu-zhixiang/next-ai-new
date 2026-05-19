# 小程序虚拟支付配置

## 云函数环境变量

- `WX_PAY_APPID`
  小程序 AppID，例如 `wx1bbde9dcd7559d54`。
- `WX_APP_SECRET`
  小程序 AppSecret，用于 `jscode2session` 换取 `session_key` 并生成虚拟支付用户态签名。
- `WX_VIRTUAL_PAY_OFFER_ID`
  小程序后台「虚拟支付」基础配置中的 OfferId。
- `WX_VIRTUAL_PAY_APP_KEY`
  小程序后台「虚拟支付」基础配置中的现网 AppKey。沙箱联调时填写沙箱 AppKey。
- `WX_VIRTUAL_PAY_ENV`
  `0` 为现网，`1` 为沙箱；不配置时默认 `0`。
- `WX_VIRTUAL_PAY_PRODUCT_ID`
  默认虚拟商品/道具 ID。也可按套餐覆盖：`WX_VIRTUAL_PAY_PRODUCT_ID_MONTHLY`、`WX_VIRTUAL_PAY_PRODUCT_ID_QUARTERLY`、`WX_VIRTUAL_PAY_PRODUCT_ID_ANNUAL`。

> 旧的 `WX_PAY_MCH_ID`、`WX_PAY_API_KEY`、`WX_PAY_NOTIFY_URL` 只用于普通微信支付 V2 兜底链路。审核版会员购买订单已改为 `wechat_virtual_pay`，不会再走普通 `wx.requestPayment`。

## 联调要点

- `create-order` 创建会员订单时写入 `payChannel: wechat_virtual_pay`。
- `pay-order` 使用虚拟支付配置生成 `wx.requestVirtualPayment` 所需的 `signData / paySig / signature / mode`。
- 前端支付前会调用 `wx.login`，把 `jsCode` 传给 `pay-order`，后端用它换取 `session_key`。
- `pay-notify` 兼容虚拟支付消息推送事件 `xpay_goods_deliver_notify` 和 `xpay_coin_pay_notify`，按 `OutTradeNo` 幂等更新订单和会员。
- 在小程序后台配置虚拟支付回调时，回调 URL 指向 `pay-notify` 的 HTTP 访问地址；校验请求携带 `echostr` 时函数会原样返回。
- 订单金额在业务表中继续按“元”存储，调用云支付时转换为“分”。

## 参考

- 微信小程序 `wx.requestVirtualPayment` 说明：
  `node_modules/miniprogram-api-typings/types/wx/lib.wx.api.d.ts`
- 微信手机号授权按钮说明：
  `node_modules/@tarojs/components/types/Button.d.ts`
