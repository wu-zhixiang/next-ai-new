# 自动续费会员订阅开发计划

本文记录后续接入微信小程序虚拟支付“会员订阅 / 自动续费”能力的开发范围。后续开发以本文为准。

参考文档：

- 会员订阅：<https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/vip.html>
- iOS 虚拟支付：<https://developers.weixin.qq.com/miniprogram/dev/platform-capabilities/business-capabilities/virtual-payment/ios.html>

## 当前结论

微信小程序虚拟支付支持会员订阅自动扣费，但它不是当前单次 `wx.requestVirtualPayment` 链路的简单开关。

需要新增一套独立链路：

```text
用户选择连续包月
-> 用户主动勾选自动续费协议
-> 创建签约
-> 用户完成签约
-> 到扣款周期服务端发起扣款
-> 支付成功进入开通/续期流程
-> 用户可在小程序内查看解约路径或发起解约
```

当前 GO / PLUS 月卡继续保留为单次购买。

## 产品形态

保留：

- `AI资讯GO会员`：单次月卡
- `AI资讯PLUS会员`：单次月卡

新增：

- `AI资讯GO连续包月`
- `AI资讯PLUS连续包月`

自动续费商品必须与单次商品同时展示，不能只提供自动续费商品。

## 合规要求

自动续费签约前必须清晰展示：

- 当前签约价格
- 后续续费原价
- 订阅周期
- 下次扣款具体日期
- 订阅包含的服务内容
- 《会员自动续费服务协议》
- 退订/解约方式

协议勾选要求：

- 不得默认勾选
- 用户必须主动勾选
- 建议二次弹窗确认

签约后要求：

- 正式周期扣款前需要提前提醒用户
- 小程序内需展示自动续费退订路径
- 需要提供客服入口
- 需要支持退款/投诉处理路径

## iOS 注意事项

iOS 虚拟支付支持 Apple 支付，接入限制：

- 只支持现网环境，不支持沙箱
- 用户需 iOS 15 及以上
- 微信客户端需 8.0.68 及以上
- 最低支付金额 1 元
- iOS 虚拟支付存在服务费率，官方文档当前标准费率为 17%，2026 年腾讯技术服务费限免后合计约 12%

现有测试价格 `0.01` 不适合 iOS 自动续费联调。

## 后台能力开通

需要在小程序后台完成：

- 已开通小程序虚拟支付
- 已配置小程序简称
- 申请会员订阅 / 自动续费订阅会员能力
- 提交《会员自动续费服务协议》
- 按平台要求缴纳交易保证金，如后台要求
- 配置连续包月道具
- 配置签约、扣款、解约相关回调

## 数据模型改造

### member_plans

新增字段建议：

```ts
billingMode: 'one_time' | 'auto_renew'
subscribePeriodDays?: number
renewPrice?: number
firstPeriodPrice?: number
agreementVersion?: string
virtualSubscribeProductId?: string
```

### memberships

当前已有部分续费字段，可继续使用并补齐：

```ts
autoRenewStatus: 'off' | 'on' | 'cancelled' | 'renew_failed'
autoRenewContractId?: string
nextRenewAt?: number
renewPrice?: number
lastRenewAt?: number
lastRenewStatus?: 'success' | 'failed'
```

### orders

新增或明确：

```ts
orderType: 'purchase' | 'renew'
billingMode?: 'one_time' | 'auto_renew'
contractId?: string
subscribePeriodDays?: number
```

### 新集合：renew_contracts

建议字段：

```ts
userId: string
productCode: string
planCode: string
outContractCode: string
contractId?: string
productId: string
status: 'signing' | 'active' | 'cancelled' | 'failed'
subscribePeriodDays: number
firstPrice: number
renewPrice: number
nextRenewAt?: number
signedAt?: number
cancelledAt?: number
createdAt: number
updatedAt: number
```

## 云函数计划

### create-subscribe-contract

职责：

- 校验用户、手机号、协议勾选状态
- 校验套餐为自动续费套餐
- 生成 `outContractCode`
- 调用官方 `create_subscribe_contract`
- 保存 `renew_contracts`
- 返回前端签约参数

### query-subscribe-contract

职责：

- 根据 `outContractCode` 查询签约状态
- 同步 `renew_contracts`
- 同步 `memberships.autoRenewStatus`

### terminate-subscribe-contract

职责：

- 用户主动取消自动续费
- 调用官方 `terminate_subscribe_contract`
- 更新 `renew_contracts.status`
- 更新 `memberships.autoRenewStatus`

### submit-subscribe-pay-order

职责：

- 定时扫描 `nextRenewAt` 到期的有效签约
- 调用官方 `submit_subscribe_pay_order`
- 生成续费订单
- 失败时记录 `renew_failed`

### pay-notify 扩展

需要支持事件：

- `xpay_subscribe_signing_result_notify`
- `xpay_subscribe_pay_fail_notify`
- `xpay_goods_deliver_notify`

签约/解约通知成功后，需要返回官方要求格式。

扣款成功后复用当前逻辑：

```text
订单 paid
-> fulfillmentStatus opening
-> 运营通知
-> 人工开通/续期
```

或后续确认自动续费无需人工处理时，可改为自动续期。

## 前端改造计划

### 会员购买弹窗

需要区分：

- 单次月卡
- 连续包月

连续包月卡片必须展示：

- 首期价格
- 后续续费价格
- 扣费周期
- 下次扣款日期
- “可随时取消”说明
- 自动续费协议入口

### 协议

新增页面：

- `会员自动续费服务协议`

必须包含：

- 服务内容
- 服务周期
- 计费周期
- 扣款时间
- 扣款金额
- 退订方式
- iOS / Android 不同退订路径
- 补扣款说明
- 退款/客服说明

### 签约确认

用户点击连续包月支付前：

- 自动续费协议必须主动勾选
- 建议二次弹窗确认
- 明确展示下次扣款日期，不能只写“到期前”或“次月”

### 会员中心

自动续费已开启时展示：

- 自动续费状态
- 下次扣款日期
- 续费金额
- 取消自动续费入口

取消入口需要清晰，不放到隐藏 FAQ。

## 部署与配置

新增环境变量建议：

```text
WX_VIRTUAL_SUBSCRIBE_PRODUCT_ID_GO
WX_VIRTUAL_SUBSCRIBE_PRODUCT_ID_PLUS
WX_SUBSCRIBE_CONTRACT_NOTIFY_URL
WX_SUBSCRIBE_PAY_NOTIFY_URL
```

最终变量名称可在实现时按官方接口字段收敛。

需要新增上传云函数：

```text
create-subscribe-contract
query-subscribe-contract
terminate-subscribe-contract
submit-subscribe-pay-order
```

并更新：

```text
pay-notify
seed-database
reset-database
list-member-plans
get-member-home
```

## 开发顺序

1. 后台确认会员订阅能力已开通。
2. 补 `member_plans` 自动续费套餐 seed。
3. 补 `renew_contracts` 数据模型。
4. 实现 `create-subscribe-contract`。
5. 前端连续包月套餐展示、协议勾选、二次确认。
6. 实现签约结果通知。
7. 实现查询签约状态。
8. 实现取消自动续费。
9. 实现周期扣款。
10. 扩展扣款成功/失败回调。
11. Android 现网联调。
12. iOS 现网联调。
13. 补退款、客服和解约路径展示。

## 暂不改动

在正式接入自动续费前，当前生产链路继续保持：

```text
单次购买
-> 支付成功
-> 开通中
-> 人工开通
-> 到期前 2 天提醒
-> 用户手动续费
```
