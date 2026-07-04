# 微信支付电子发票开发文档

更新时间：`2026-07-04`

## 1. 结论

> 当前状态：该文档保留为微信支付/服务商自动开票调研材料，不再作为当前 MVP 主流程。微信支付客服确认当前普通商户不能直接使用微信支付侧自动开票能力，需要接入电子发票服务商。当前已切回“用户申请 + 运营人工开票”，见 [invoice-mvp-plan.md](/Users/qitmac001343/Desktop/ai-business/gpt-pay/docs/invoice-mvp-plan.md)。

后续如果接入服务商自动开票，可参考本文继续改造。

历史自动开票流程：

当前合理流程：

1. 商户先在微信支付商户平台开通电子发票权限。
2. 后端调用 `setup-fapiao-config` 配置开发选项和回调地址。
3. 用户在小程序会员中心点击 `开发票`。
4. 用户选择一个已支付且已完成开通的微信支付订单。
5. 用户填写购买方抬头信息。
6. 后端生成本地发票申请记录。
7. 后端调用微信支付 `开具电子发票` API。
8. 微信支付返回 `202 Accepted` 后，本地状态进入 `开票中`。
9. 微信支付通过回调通知开票成功，或后端主动查询开票结果。
10. 用户在小程序发票列表看到 `已开票`。
11. 用户点击查看/下载时，后端实时获取下载信息并下载 PDF，上传云存储后返回文件。

运营插件只做异常处理和状态查看，不作为主开票入口。

## 2. 当前项目状态

已落地：

- 小程序会员中心已新增 `开发票` 入口。
- 已新增 `pages/invoice/index` 发票申请页。
- 已新增 `invoice_requests` 集合常量。
- 已新增用户侧云函数：
  - `list-invoice-orders`
  - `setup-fapiao-config`
  - `submit-invoice-request`
- 运营插件已新增 `开发票` tab。
- `operator-api` 已新增发票列表和状态更新接口。

本次已调整：

- 用户侧从“多订单合并开票”改为“单订单开票”。
- 可开票订单必须有微信支付订单号 `transactionId`。
- 小程序文案改为微信电子发票语义。
- 发票记录类型预留微信电子发票字段。

已新增但未联调：

- 微信支付 API v3 请求签名模块。
- 微信支付公钥加密敏感字段模块。
- `submit-invoice-request` 已在配置完整时调用 `开具电子发票` API。

尚未接入：

- 查询电子发票。

已新增但待联调：

- 发票开具成功回调 `fapiao-notify`。
- 获取发票下载信息。
- 下载 PDF/OFD 并上传云存储。

## 3. 微信文档要点

### 3.1 配置开发选项

接口：

```text
PATCH https://api.mch.weixin.qq.com/v3/new-tax-control-fapiao/merchant/development-config
```

文档更新时间：`2025-09-26`

用途：

- 配置电子发票回调地址。
- 配置是否在微信支付全部账单展示开发票入口。

当前项目建议：

- `callback_url` 配置为云函数 `fapiao-notify` 的可公网访问 HTTP 地址。
- `show_fapiao_cell` 先配置为 `false`，用户开票入口由小程序会员中心承接。

### 3.2 创建电子发票卡券模板

接口：

```text
POST https://api.mch.weixin.qq.com/v3/new-tax-control-fapiao/card-template
```

文档更新时间：`2025-09-26`

关键规则：

- 商户必须先创建电子发票卡券模板，才能调用开票相关接口。
- 调用该接口会覆盖商户之前配置的电子发票卡券模板。
- 直连普通商户模式下，`card_appid` 是直连商户申请并绑定的 AppID。
- `logo_url` 必须是微信侧可访问的卡券 logo 地址。

当前项目通过 `setup-fapiao-config` 配置开发选项。只有配置 `WECHAT_FAPIAO_ENABLE_CARD_TEMPLATE=true` 时，才会继续创建卡券模板。该函数不是用户链路函数，只应在商户配置变更时由开发/运营手动调用。

当前只有小程序、暂不做微信卡包时，先不启用卡券模板，MVP 以“小程序展示/下载发票文件”为准。后续申请并绑定公众号后，再启用卡券模板和插卡能力。

### 3.3 开具电子发票

接口：

```text
POST https://api.mch.weixin.qq.com/v3/new-tax-control-fapiao/fapiao-applications
```

文档更新时间：`2025-09-26`

关键规则：

- 微信支付场景使用 `scene = WITH_WECHATPAY`。
- 微信支付场景无需额外获取用户授权。
- `fapiao_apply_id` 必须是关联的微信支付订单号。
- 本接口成功返回 `202 Accepted`，只表示开票请求被受理。
- 最终结果需要等待微信支付回调，或主动查询电子发票。
- 发票开具成功后会插入微信用户卡包。

重要约束：

- 微信支付场景下，所有发票金额合计不能超过对应微信支付订单总金额。
- 因为 `fapiao_apply_id` 绑定单个微信支付订单号，MVP 不做多个订单合并开一张票。

### 3.4 下载发票文件

下载接口本身不签名、不验签，但不能直接拼 URL。

流程：

1. 调用 `获取发票下载信息`。
2. 获得 `download_url`。
3. 该 URL 有效期 30 秒。
4. 调用下载 URL 获取 PDF/OFD 二进制流。

下载 URL 需要带：

- `token`
- `mchid`
- `openid`，来自查询电子发票接口返回的 `card_openid`
- `invoice_code`
- `invoice_no`
- `fapiao_id`

建议后端下载后上传云存储，不建议小程序直接依赖 30 秒 URL。

## 4. 数据库设计

### 4.1 新增集合

需要新建集合：

```text
invoice_requests
```

当前代码会在提交申请时通过 `ensureCollection('invoiceRequests')` 尝试创建集合。生产环境仍建议在云开发控制台手动确认集合已存在。

### 4.2 `invoice_requests` 字段

核心字段：

```ts
interface InvoiceRequestRecord {
  invoiceNo: string;              // 本地申请号
  userId: string;
  openid: string;

  scene: 'WITH_WECHATPAY';
  fapiaoApplyId: string;          // 微信支付 transaction_id
  fapiaoId: string;               // 商户发票单号，建议使用 invoiceNo
  wechatTransactionId: string;

  orderNos: string[];             // MVP 只允许 1 个订单
  orders: Array<{
    orderNo: string;
    productCode: string;
    productName: string;
    planCode: string;
    planName: string;
    amount: number;               // 元
    paidAt?: number;
    fulfilledAt?: number;
  }>;

  amount: number;                 // 元
  titleType: 'personal' | 'company';
  title: string;
  taxNo?: string;
  email: string;

  status: 'submitted' | 'processing' | 'issued' | 'failed' | 'rejected';
  wechatFapiaoStatus?: string;
  failReason?: string;
  rejectReason?: string;
  operatorNote?: string;

  cardOpenid?: string;
  invoiceCode?: string;
  invoiceNumber?: string;
  invoiceNoFromWechat?: string;
  invoiceFileUrl?: string;
  invoiceFileId?: string;
  invoiceDownloadUrl?: string;
  invoiceDownloadUrlExpireAt?: number;
  sm3Digest?: string;

  issuedAt?: number;
  operatorUpdatedAt?: number;
  createdAt: number;
  updatedAt: number;
}
```

### 4.3 `orders` 冗余字段

继续保留：

```ts
invoiceStatus?: 'none' | 'submitted' | 'processing' | 'issued' | 'failed' | 'rejected';
invoiceNo?: string;
```

用途：

- 过滤可开票订单。
- 防止同一订单重复申请。
- 服务记录页后续可展示开票状态。

## 5. 用户流程

### 5.1 可开票订单

订单必须满足：

- `payStatus === 'paid'`
- `fulfillmentStatus === 'fulfilled'`
- `transactionId` 存在
- 未处于 `submitted / processing / issued`

说明：

- `transactionId` 应存微信支付返回的 `transaction_id`。
- 虚拟支付或无微信支付订单号的订单暂不支持微信电子发票。

### 5.2 提交申请

用户填写：

- 发票类型：个人 / 企业
- 发票抬头
- 企业税号，企业必填
- 接收邮箱

后端生成：

- `invoiceNo`
- `fapiaoApplyId = order.transactionId`
- `fapiaoId = invoiceNo`
- 本地状态 `submitted`

当前代码行为：

- 调用开票 API 成功返回 `202` 后，状态改为 `processing`
- 调用失败则状态改为 `failed`，写入 `failReason`
- 如果缺少微信支付 API v3、公钥或税收分类配置，也会标记为 `failed` 并返回明确错误。

## 6. 微信支付 API 接入设计

### 6.1 环境变量

建议新增：

```text
WECHAT_PAY_MCH_ID
WECHAT_PAY_API_V3_KEY
WECHAT_PAY_MERCHANT_SERIAL_NO
WECHAT_PAY_PRIVATE_KEY
WECHAT_PAY_PUBLIC_KEY_ID
WECHAT_PAY_PUBLIC_KEY
WECHAT_FAPIAO_SETUP_TOKEN
WECHAT_FAPIAO_CALLBACK_URL
WECHAT_FAPIAO_SHOW_CELL
WECHAT_FAPIAO_ENABLE_CARD_TEMPLATE
WECHAT_FAPIAO_CARD_APPID
WECHAT_FAPIAO_CARD_LOGO_URL
WECHAT_FAPIAO_CARD_PAYEE_NAME
WECHAT_FAPIAO_CARD_CELL_WORDS
WECHAT_FAPIAO_CARD_CELL_DESCRIPTION
WECHAT_FAPIAO_CARD_CELL_JUMP_URL
WECHAT_FAPIAO_CARD_CELL_MINIPROGRAM_USER_NAME
WECHAT_FAPIAO_CARD_CELL_MINIPROGRAM_PATH
WECHAT_FAPIAO_TAX_CODE
WECHAT_FAPIAO_GOODS_NAME
WECHAT_FAPIAO_GOODS_CATEGORY
WECHAT_FAPIAO_GOODS_ID
WECHAT_FAPIAO_TAX_RATE
WECHAT_FAPIAO_UNIT
WECHAT_FAPIAO_REMARK
```

其中：

- `WECHAT_PAY_PRIVATE_KEY` 用于 API v3 签名。
- `WECHAT_PAY_PUBLIC_KEY_ID / WECHAT_PAY_PUBLIC_KEY` 用于加密邮箱、手机号等敏感字段。
- `WECHAT_FAPIAO_CALLBACK_URL` 用于一次性初始化电子发票开发选项。
- `WECHAT_FAPIAO_ENABLE_CARD_TEMPLATE / WECHAT_FAPIAO_CARD_*` 只在后续接入公众号卡包时使用。
- 税收分类相关字段来自微信电子发票商户平台或“获取商户可开具的商品和服务税收分类编码对照表”接口。

### 6.2 请求签名

需要新增公共模块：

```text
cloudfunctions/shared/wechat-pay-v3.ts
```

能力：

- 生成 nonce。
- 生成 timestamp。
- 构造签名串。
- 使用商户私钥 RSA-SHA256 签名。
- 生成 `Authorization: WECHATPAY2-SHA256-RSA2048 ...`。
- 发起 HTTPS JSON 请求。

### 6.3 敏感字段加密

文档要求：

- `buyer_information.phone`
- `buyer_information.email`

需要使用微信支付公钥或平台证书公钥加密。

MVP 策略：

- 如果没有完成公钥配置，可以先不传 `phone`。
- `email` 若要传给微信，也必须加密。
- 如果邮箱不是开票接口必需字段，可先仅保存在本地，用于用户侧展示和兜底联系。

### 6.4 开票请求体

MVP 请求体建议：

```ts
{
  scene: 'WITH_WECHATPAY',
  fapiao_apply_id: order.transactionId,
  buyer_information: {
    type: titleType === 'company' ? 'ORGANIZATION' : 'INDIVIDUAL',
    name: title,
    taxpayer_id: titleType === 'company' ? taxNo : undefined,
    email: encryptedEmail,
  },
  fapiao_information: [
    {
      fapiao_id: invoiceNo,
      total_amount: Math.round(order.amount * 100),
      need_list: false,
      remark,
      items: [
        {
          tax_code,
          goods_category,
          goods_name,
          goods_id,
          unit,
          quantity: 100000000,
          total_amount: Math.round(order.amount * 100),
          tax_rate,
          discount: false,
        },
      ],
    },
  ],
}
```

## 7. 回调与状态

### 7.1 新增云函数

建议新增：

```text
cloudfunctions/fapiao-notify/index.ts
```

职责：

- 接收微信支付发票开具成功通知。
- 验签。
- 解密回调报文。
- 根据 `fapiao_id` 或 `fapiao_apply_id` 找到 `invoice_requests`。
- 写入 `issued` 状态、发票代码、发票号码、`card_openid`、微信状态。
- 同步更新订单 `invoiceStatus = issued`。

### 7.2 状态映射

| 本地状态 | 用户展示 | 说明 |
|---|---|---|
| `submitted` | 已受理 | 本地申请已创建，准备调用微信 API |
| `processing` | 开票中 | 微信 API 已受理，等待回调/查询 |
| `issued` | 已开票 | 微信确认开票成功 |
| `failed` | 开票失败 | 微信 API 或查询返回失败 |
| `rejected` | 已驳回 | 运营人工驳回，仅异常兜底使用 |

## 8. 查询与下载

### 8.1 查询电子发票

需要接入微信支付 `查询电子发票` 接口。

用途：

- 回调丢失时主动补偿。
- 获取 `card_openid`、`invoice_code`、`invoice_no`、`fapiao_id` 等下载所需字段。

建议新增云函数：

```text
cloudfunctions/sync-fapiao-result/index.ts
```

运营插件可触发该函数重查失败或长时间 `processing` 的申请。

### 8.2 获取下载信息

建议新增云函数：

```text
cloudfunctions/get-fapiao-file/index.ts
```

流程：

1. 校验当前用户只能下载自己的发票。
2. 检查本地状态必须为 `issued`。
3. 如果已有 `invoiceFileId`，直接返回云存储 fileId。
4. 调用微信支付 `获取发票下载信息`。
5. 取得 30 秒 `download_url`。
6. 拼接 `mchid / card_openid / invoice_code / invoice_no / fapiao_id`。
7. 下载 PDF/OFD 二进制。
8. 上传云存储。
9. 回写 `invoiceFileId / sm3Digest`。
10. 返回 fileId 给小程序。

不建议小程序直接打开 30 秒 `download_url`。

## 9. 运营插件定位

电子发票接通后，运营插件的 `开发票` tab 应改为异常处理台：

- 查看 `submitted / processing / failed` 申请。
- 对 `processing` 申请触发主动查询。
- 对 `failed` 申请查看失败原因。
- 允许运营标记 `rejected`，但不作为主开票路径。

不再推荐运营手工填写发票号码作为常规流程。

## 10. 开发任务拆解

### Phase 1：当前可先完成

- [x] 小程序新增开发票入口。
- [x] 小程序新增发票申请页。
- [x] 新增 `invoice_requests` 类型和集合常量。
- [x] 新增用户侧列表/提交云函数。
- [x] 改为单订单开票。
- [x] 要求订单必须有微信支付 `transactionId`。
- [x] 新增开发文档。

### Phase 2：微信 API 基础设施

- [x] 新增 `wechat-pay-v3.ts` 签名请求模块。
- [x] 新增微信支付公钥敏感字段加密模块。
- [x] 新增 `setup-fapiao-config` 初始化开发选项和卡券模板。
- [x] 补齐云函数环境变量文档。
- [ ] 增加签名单元测试。

### Phase 3：开票 API

- [x] `submit-invoice-request` 创建本地记录后调用微信开票 API。
- [x] 微信返回 `202` 后更新 `status=processing`。
- [x] 微信返回错误后更新 `status=failed/failReason`。
- [ ] 运营插件展示微信失败原因。

### Phase 4：回调和查询

- [x] 新增 `fapiao-notify`。
- [x] 验签和解密回调。
- [ ] 新增 `sync-fapiao-result` 主动查询。
- [x] 回写 `issued` 状态和下载所需字段。

### Phase 5：下载

- [x] 新增 `get-fapiao-file`。
- [x] 获取 30 秒下载 URL。
- [x] 后端下载发票文件。
- [x] 上传云存储。
- [x] 小程序申请记录增加 `查看发票` 按钮。

## 11. 当前上线注意

当前代码在未接微信 API 前，只能完成本地申请记录和运营插件查看，不能真正自动开票。

如果要避免误导用户，上线前建议：

- 后端未配置微信电子发票 API 时，`submit-invoice-request` 返回“电子发票接口配置中，请稍后再试”。
- 或者保留当前本地申请，但页面文案明确为“开票申请已受理，开票完成后将进入微信卡包”。

正式接微信 API 前必须确认：

- 微信支付订单已使用普通微信支付并产生 `transaction_id`。
- 商户已开通电子发票产品权限。
- 商户已配置电子发票卡券模板。
- 商户已配置可用税收分类编码。
- 云函数已配置商户私钥、公钥 ID、公钥、商户证书序列号。
- 发票回调地址已配置并可访问。
