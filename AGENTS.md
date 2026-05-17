# AI 会员开发记录

更新时间：`2026-05-12`

## 当前产品决策

- 小程序启动时静默调用 `user-login`，不强制用户进来先绑定手机号。
- 手机号绑定只在首次开通会员时触发。
- 购买入口已从独立套餐页收回到会员中心弹窗。
- 弹窗内下单前校验是否已绑定，未绑定则在当前页直接拉起微信 `getPhoneNumber`。
- 不再保留独立的“绑定手机号”页面，也不再保留独立套餐页作为正式用户入口。
- 会员产品开始按“多产品”方向设计，当前已上线 `AI 会员`，预留 `Claude 会员` 标签与弹窗入口。

## 当前实现状态

- [src/app.tsx](/Users/qitmac001343/Desktop/ai-business/gpt-pay/src/app.tsx:1)
  已加入静默 `user-login` 初始化。
- [src/pages/plans/index.tsx](/Users/qitmac001343/Desktop/ai-business/gpt-pay/src/pages/plans/index.tsx:1)
  已不再作为正式页面注册，保留文件仅供旧实现参考。
- [src/pages/member/index.tsx](/Users/qitmac001343/Desktop/ai-business/gpt-pay/src/pages/member/index.tsx:1)
  现在先展示会员标签，点击后拉起会员方案弹窗，弹窗内直接完成授权、下单与支付跳转。

## 当前技术债

- [cloudfunctions/bind-mobile/index.ts](/Users/qitmac001343/Desktop/ai-business/gpt-pay/cloudfunctions/bind-mobile/index.ts:1)
  已改为通过 `openapi.phonenumber.getPhoneNumber` 获取真实手机号；正式环境仍需确认云函数权限与隐私授权配置完整。
- [src/utils/mobile.ts](/Users/qitmac001343/Desktop/ai-business/gpt-pay/src/utils/mobile.ts:1)
  已切到真实手机号脱敏展示逻辑。
- 当前后端已落多产品基础字段：
  - `member_plans` 已增加 `productCode / productName`
  - `memberships` 已增加 `productCode / productName`
  - `orders` 也已补齐 `productCode / productName`
- 当前剩余阻塞项主要集中在支付环境配置与真实商户联调：
  - 云支付环境变量需补齐
  - `pay-notify` 的真实回调报文需在联调环境下验收
  - `Claude 会员` 仍只有前端占位入口，未接入独立套餐和交付链路

## UI 与参考资源

- 会员中心参考资源：
  [reference.html](/Users/qitmac001343/Desktop/ai-business/gpt-pay/src/pages/member/stitch-assets/reference.html:1)
  [design.png](/Users/qitmac001343/Desktop/ai-business/gpt-pay/src/pages/member/stitch-assets/design.png:1)
- 套餐页参考资源：
  [reference.html](/Users/qitmac001343/Desktop/ai-business/gpt-pay/src/pages/plans/stitch-assets/reference.html:1)
  [design.png](/Users/qitmac001343/Desktop/ai-business/gpt-pay/src/pages/plans/stitch-assets/design.png:1)
- 支付结果页参考资源：
  [reference.html](/Users/qitmac001343/Desktop/ai-business/gpt-pay/src/pages/pay-result/stitch-assets/reference.html:1)
  [design.png](/Users/qitmac001343/Desktop/ai-business/gpt-pay/src/pages/pay-result/stitch-assets/design.png:1)

## 已知约定

- 头部统一使用会员中心那套公共头部，返回按钮是纯箭头，不带圆框。
- 用户可先浏览，再在首次购买时完成微信手机号授权，不做“进门即拦截”。
- 当前项目通过 `miniprogram-ci` / CLI 上传云函数代码后，云端代码更新可能成功，但“云端安装依赖 / OpenAPI 权限配置”不一定稳定生效。涉及 `config.json` 权限声明、依赖安装或手机号 OpenAPI 权限问题时，优先在微信开发者工具或云开发控制台对目标函数执行一次“上传并部署：云端安装依赖”后再验证。
