# 微信支付 V2 直连配置

## 云函数环境变量

- `WX_PAY_APPID`
  小程序 AppID，例如 `wx1bbde9dcd7559d54`。
- `WX_PAY_MCH_ID`
  普通直连商户号。
- `WX_PAY_API_KEY`
  微信支付 API v2 密钥，只能配置在云函数环境变量中。
- `WX_PAY_NOTIFY_URL`
  微信支付能公网访问的 HTTPS 回调地址，例如 CloudBase HTTP 访问服务路径。
- `WX_PAY_SPBILL_CREATE_IP`
  下单 IP，默认 `127.0.0.1`。

## 联调要点

- `pay-order` 负责生成小程序 `requestPayment` 所需参数。
- `pay-notify` 负责接收微信支付 V2 XML 回调、验签、幂等更新订单和会员。
- 订单金额在业务表中继续按“元”存储，调用云支付时转换为“分”。
- 当前项目不再使用 CloudBase `cloud.cloudPay.unifiedOrder`，避免普通直连商户被云支付封装要求 `sub_mch_id`。

## 参考

- 微信小程序 `wx.requestPayment` 说明：
  `node_modules/miniprogram-api-typings/types/wx/lib.wx.api.d.ts`
- 微信手机号授权按钮说明：
  `node_modules/@tarojs/components/types/Button.d.ts`
