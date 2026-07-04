# 发票功能 MVP 落地方案

更新时间：`2026-07-04`

> 状态更新：微信支付客服确认当前普通商户不能直接使用微信支付侧自动开票能力，需要接入服务商。当前主方案切回“用户申请 + 运营人工开票”的 MVP。微信支付电子发票 API 链路仅作为后续服务商接入参考，见 [wechatpay-fapiao-flow.md](/Users/qitmac001343/Desktop/ai-business/gpt-pay/docs/wechatpay-fapiao-flow.md)。

## 1. 目标

在现有会员小程序和运营插件体系内增加“开发票”能力。

MVP 版本不直接接税控/电子发票服务商自动开票，先完成：

- 用户可在小程序会员中心提交发票申请。
- 只有已完成支付并已完成开通的订单可申请开票。
- 支持多个符合条件的订单合并开一张发票。
- 运营插件新增“开发票” tab，展示待开票申请。
- 运营人员人工开票后，在插件内录入发票信息并标记完成。
- 用户可看到开票申请状态和发票结果。

## 2. 产品范围

### 2.1 小程序端

会员中心在“我的客服”下方新增入口：

- `开发票`

点击后进入发票申请页或弹层，MVP 推荐新页面：

- `pages/invoice/index`

页面能力：

- 展示可开票订单列表。
- 用户可多选订单。
- 自动汇总可开票金额。
- 填写发票信息。
- 提交发票申请。
- 展示历史发票申请记录。

### 2.2 运营插件端

运营插件新增 tab：

- `开发票`

页面能力：

- 加载待开发票申请。
- 查看用户提交的发票抬头、税号、邮箱、订单明细和合计金额。
- 标记处理中。
- 标记已开票。
- 填写发票号码、发票链接、备注。
- 支持复制用户邮箱、税号、订单号。
- 支持导出税务局“发票开具项目信息导入模板”格式的项目明细 XLSX，减少手工录入金额、项目名和税率。

### 2.3 后端

新增发票申请集合和云函数能力：

- 用户侧提交发票申请。
- 用户侧查看自己的发票申请。
- 运营侧查看所有待开发票申请。
- 运营侧更新发票申请状态。

## 3. 关键业务规则

### 3.1 可开票订单条件

订单必须同时满足：

- `payStatus === 'paid'`
- `fulfillmentStatus === 'fulfilled'`
- 未退款
- 未被其他已提交/处理中/已开票申请占用

说明：

- `opening` 不允许开票，因为还没有完成开通。
- `pending/failed/closed/refunded` 不允许开票。
- 同一个订单只能进入一个有效发票申请。

### 3.2 多订单合并开票

用户可选择多个订单合并开一张发票。

限制：

- 所选订单必须属于当前用户。
- 所选订单都必须满足可开票条件。
- 发票金额 = 所选订单实付金额合计。
- MVP 不支持部分金额开票。
- MVP 不支持一个订单拆成多张发票。

### 3.3 发票类型

MVP 支持：

- 个人普通发票
- 企业普通发票

暂不支持：

- 专票
- 红冲
- 自动作废
- 自动重开
- 税控平台直连

企业发票必填：

- 发票抬头
- 纳税人识别号

个人发票必填：

- 发票抬头

所有类型必填：

- 接收邮箱

## 4. 数据模型

### 4.1 新增集合：`invoiceRequests`

```ts
interface InvoiceRequestRecord {
  _id?: string;
  invoiceNo: string;
  userId: string;
  openid: string;

  orderNos: string[];
  orders: Array<{
    orderNo: string;
    productCode: string;
    productName: string;
    planCode: string;
    planName: string;
    amount: number;
    paidAt?: number;
    fulfilledAt?: number;
  }>;

  amount: number;
  titleType: 'personal' | 'company';
  title: string;
  taxNo?: string;
  email: string;

  status: 'submitted' | 'processing' | 'issued' | 'rejected';
  operatorNote?: string;
  rejectReason?: string;

  invoiceCode?: string;
  invoiceNumber?: string;
  invoiceFileUrl?: string;
  issuedAt?: number;
  operatorUpdatedAt?: number;

  createdAt: number;
  updatedAt: number;
}
```

### 4.2 订单集合是否加字段

MVP 推荐在 `orders` 集合冗余两个字段，便于列表判断：

```ts
invoiceStatus?: 'none' | 'submitted' | 'processing' | 'issued' | 'rejected';
invoiceNo?: string;
```

提交发票申请时批量更新订单：

- `invoiceStatus = 'submitted'`
- `invoiceNo = invoiceRequest.invoiceNo`

运营标记已开票后批量更新订单：

- `invoiceStatus = 'issued'`

驳回后：

- `invoiceStatus = 'rejected'`

如果后续允许驳回后重新申请，需要在重新申请前允许 `rejected` 状态订单再次进入申请。

## 5. 云函数设计

### 5.1 `list-invoice-orders`

用户侧：列出当前用户可开票订单和历史发票申请。

入参：

```json
{}
```

返回：

```ts
{
  availableOrders: Array<{
    orderNo: string;
    productName: string;
    planName: string;
    amount: number;
    paidAt?: number;
    fulfilledAt?: number;
  }>;
  invoiceRequests: InvoiceRequestView[];
}
```

校验：

- 通过 `OPENID` 定位用户。
- 只返回当前用户订单。

### 5.2 `submit-invoice-request`

用户侧：提交开票申请。

入参：

```ts
{
  orderNos: string[];
  titleType: 'personal' | 'company';
  title: string;
  taxNo?: string;
  email: string;
}
```

校验：

- 用户必须存在。
- `orderNos` 非空。
- 所有订单属于当前用户。
- 所有订单已支付且已开通。
- 所有订单未被有效发票申请占用。
- 企业发票必须填写税号。
- 邮箱格式正确。

返回：

```ts
{
  invoiceNo: string;
  status: 'submitted';
}
```

### 5.3 `operator-api` 新增发票接口

复用现有运营插件 HTTP 接口和 `OPERATOR_API_TOKEN` 鉴权。

建议新增路由：

- `GET /operator/invoices?status=submitted`
- `POST /operator/invoices/:invoiceNo`

`GET` 返回待处理发票：

```ts
{
  invoices: InvoiceRequestView[];
}
```

`POST` 更新状态：

```ts
{
  status: 'processing' | 'issued' | 'rejected';
  operatorNote?: string;
  rejectReason?: string;
  invoiceCode?: string;
  invoiceNumber?: string;
  invoiceFileUrl?: string;
}
```

状态流转：

- `submitted -> processing`
- `submitted/processing -> issued`
- `submitted/processing -> rejected`

## 6. 小程序页面设计

### 6.1 会员中心入口

位置：

- `我的客服` 下方

入口文案：

- 标题：`开发票`
- 描述：`已完成订单可合并申请开票`

点击：

- 跳转 `pages/invoice/index`

### 6.2 发票申请页

模块：

- 可开票订单
- 发票信息
- 历史申请

订单选择：

- 只展示符合条件的订单。
- 支持多选。
- 顶部展示合计金额。

表单字段：

- 发票类型：个人 / 企业
- 发票抬头
- 纳税人识别号，企业必填
- 接收邮箱

提交按钮：

- `提交开票申请`

空状态：

- `暂无可开票订单`
- `已支付并完成开通的订单会展示在这里`

状态展示：

- `已提交`
- `处理中`
- `已开票`
- `已驳回`

## 7. 运营插件设计

### 7.1 新增 tab

现有 tab：

- 订单
- 资讯
- 注册

新增：

- 开发票

### 7.2 发票 tab 信息结构

每个发票申请卡片展示：

- 发票申请号
- 状态
- 用户昵称/手机号
- 发票类型
- 发票抬头
- 纳税人识别号
- 接收邮箱
- 合计金额
- 订单列表
- 申请时间

操作：

- 复制邮箱
- 复制税号
- 标记处理中
- 标记已开票
- 驳回

标记已开票字段：

- 发票代码，可选
- 发票号码，可选
- 发票文件链接，可选
- 运营备注，可选

MVP 可以先不上传文件，只填写链接。

## 8. 实施任务拆解

### Phase 1：数据和接口

#### Task 1：补充类型和数据模型

文件：

- `cloudfunctions/shared/types.ts`
- `src/types/index.ts`

验收：

- [ ] 新增 `InvoiceRequestRecord`
- [ ] 新增前端 `InvoiceRequestView`
- [ ] `OrderRecord` 支持 `invoiceStatus/invoiceNo`

验证：

- [ ] `npm run typecheck`

#### Task 2：实现用户侧发票列表接口

新增云函数：

- `cloudfunctions/list-invoice-orders/index.ts`

验收：

- [ ] 返回当前用户可开票订单
- [ ] 返回当前用户历史发票申请
- [ ] 过滤未支付、未开通、已占用订单

验证：

- [ ] 增加单元测试覆盖订单过滤规则

#### Task 3：实现用户侧提交发票申请接口

新增云函数：

- `cloudfunctions/submit-invoice-request/index.ts`

验收：

- [ ] 多订单可合并提交
- [ ] 企业发票校验税号
- [ ] 重复开票被拦截
- [ ] 提交后订单写入 `invoiceStatus/invoiceNo`

验证：

- [ ] 单元测试覆盖重复提交、非本人订单、未开通订单

### Phase 2：小程序端

#### Task 4：会员中心增加开发票入口

文件：

- `src/pages/member/index.tsx`
- `src/styles/app.scss`

验收：

- [ ] “开发票”位于“我的客服”下方
- [ ] 点击跳转发票申请页

#### Task 5：新增发票申请页

文件：

- `src/app.config.ts`
- `src/pages/invoice/index.tsx`
- `src/pages/invoice/index.config.ts`
- `src/styles/app.scss`

验收：

- [ ] 展示可开票订单
- [ ] 支持多选并计算合计金额
- [ ] 支持填写发票信息
- [ ] 支持提交申请
- [ ] 展示历史申请状态

验证：

- [ ] `npm run typecheck`
- [ ] 小程序手动验证：无订单、有订单、重复提交

### Phase 3：运营插件

#### Task 6：operator-api 增加发票管理接口

文件：

- `cloudfunctions/operator-api/index.ts`

验收：

- [ ] `GET /operator/invoices` 可按状态加载发票申请
- [ ] `POST /operator/invoices/:invoiceNo` 可更新状态
- [ ] 已开票后订单同步更新为 `invoiceStatus=issued`

验证：

- [ ] 手动 curl 或插件调用验证

#### Task 7：运营插件新增开发票 tab

文件：

- `operator-extension/popup.html`
- `operator-extension/popup.js`
- `operator-extension/styles.css`

验收：

- [ ] 有“开发票” tab
- [ ] 可加载待开发票申请
- [ ] 可复制邮箱/税号
- [ ] 可标记处理中、已开票、驳回

### Phase 4：部署和文档

#### Task 8：构建与部署清单

验收：

- [ ] `node scripts/build-cloudfunctions.mjs` 通过
- [ ] 云函数部署清单包含：
  - `list-invoice-orders`
  - `submit-invoice-request`
  - `operator-api`
  - `list-orders`，如果订单返回字段需要同步
- [ ] 更新 `docs/setup.md` 发票配置说明

## 9. 风险和处理

| 风险 | 影响 | 处理 |
|---|---|---|
| 自动开票涉及税控合规 | 高 | MVP 只做申请和运营人工处理 |
| 用户重复申请同一订单 | 中 | 订单写入 `invoiceStatus/invoiceNo` 并在提交时二次校验 |
| 多订单合并金额错误 | 高 | 后端按订单表重新计算金额，不信任前端传入 |
| 已退款订单开票 | 高 | 提交时校验 `payStatus !== refunded` |
| 插件误操作已开票 | 中 | 状态流转限制，已开票不允许回退，MVP 只允许备注修正 |

## 10. 非 MVP 范围

- 电子发票服务商 API 自动开票
- 发票 PDF/OFD 自动生成
- 微信卡包发票
- 红冲/作废/重开
- 专票
- 发票抬头微信 API 自动读取
- 复杂审批流

## 11. 后续自动开票升级方向

订单量稳定后可接入电子发票服务商：

- 航信
- 百望
- 票通
- 用友/金蝶税务云

升级时保留当前 `invoiceRequests` 作为业务申请单，只增加：

- 服务商请求记录
- 服务商开票状态回调
- 发票文件自动回写
- 失败重试机制
