# 开发进度

## 第一阶段：支付闭环

- [x] 初始化 Taro + CloudBase 工程骨架
- [x] 建立共享类型、基础工具和云函数目录
- [x] 完成第一批云函数：登录、绑定手机号、套餐列表、会员首页
- [x] 完成基础资料云函数：个人中心、订阅消息授权
- [x] 完成订单基础云函数：创建订单、支付参数占位、支付结果查询、支付回调骨架
- [x] 完成第一批小程序页面：首页、登录页、套餐页、支付结果页、会员中心、个人中心
- [x] 完成小程序核心交互：登录、绑定手机号、创建订单、模拟支付成功、提醒授权入口
- [x] 接入云开发微信支付统一下单与真实回调处理骨架
- [x] 增加数据库初始化脚本（`seed-database`）
- [x] 增加后台 WeDa 页面定义草案
- [ ] 完成真实商户环境联调与回调验收
- [ ] 接入真实微信订阅消息模板

## 说明

- 当前 `pay-order` 已调用云开发 `cloud.cloudPay.unifiedOrder` 返回真实支付参数。
- 当前 `pay-notify` 已兼容真实回调字段与开发态手动调试，但仍需在商户环境完成最终验收。
- 云函数上传部署由开发者手动操作；Codex 只维护代码、构建/上传清单，并在交付说明里列出需要部署的函数。
- 涉及 `wx-server-sdk` 的云函数必须选择“云端安装依赖”或使用 `miniprogram-ci --remote-npm-install true`，否则运行时会报 `Cannot find module 'wx-server-sdk'`。

## 第二阶段：AI资讯会员业务闭环

### 目标

围绕 `Open AI资讯会员` 与 `Anthropic资讯会员` 建立完整链路：首次登录建档、邀请关系、AI账号注册、套餐购买、后台处理、会员开通计时、积分返还/抵扣、服务记录展示。

### 状态模型

- `none`：当前用户没有购买任何套餐，前端显示 `立即开通`。
- `registered_unpaid`：用户已注册 AI 账号但未支付，可直接进入套餐浮层。
- `paid_pending_delivery`：订单已支付但后台系统未处理完成，前端显示 `开通中`。
- `active`：后台系统处理完成并写入会员有效期，前端显示 `已开通`。
- `expired/cancelled`：会员已过期或取消，后续按续费场景处理。

### 数据模型待补充

- `users`：补充 `nickname/avatarUrl/inviterUserId/inviteCode/aiAccountRegistered/aiAccountEmail/aiAccountPasswordEncrypted/pointsBalance`。
- `orders`：补充 `pointsDeducted/cashAmount/inviteRewardPoints/serviceStatus`。
- `points_ledger`：记录积分获得、抵扣、返还、回滚，保证幂等和可追溯；当前已接邀请返积分流水。
- `invite_relations`：记录邀请人、被邀请人、分享参数、绑定时间；当前已接分享登录自动绑定。
- `memberships`：会员开通成功后写入 `startAt/endAt/remainDays/status`，计时从后台处理完成时开始。

### 实施计划

- [ ] 登录弹窗：首次进入首页若无本地缓存，展示毛玻璃登录弹窗；点击 `微信授权登录` 获取用户信息并调用 `user-login`，成功后写本地缓存。
- [x] 邀请关系：分享链接携带当前用户 `inviteCode`，被邀请用户首次登录后绑定上级，防止自邀和重复绑定。
- [x] 邀请页：展示邀请人数、积分余额、被邀请人列表；点击邀请好友触发微信分享；`invite-info` 展示积分规则。
- [ ] AI账号注册：会员中心点击 `立即开通` 时先检测是否已注册 AI 账号；未注册先弹注册浮层，保存账号密码后再弹套餐浮层。
- [ ] 套餐购买：下单时由后端计算积分抵扣和实付金额，支付成功后订单进入 `paid_pending_delivery`。
- [ ] 后台处理：后台处理完成后写入会员记录，状态变为 `active`，会员从处理完成时间开始计时 30 天。
- [ ] 服务记录：展示当前用户订单列表，字段以现有 UI 为准，支持查看服务详情。
- [ ] 积分返还与抵扣：被邀请用户订阅后邀请人获得实付金额 10% 积分返还；支付自动抵扣可用积分仍待接入下单金额计算。
- [ ] 账号信息：会员开通后展示后台注册的会员邮箱账号；点击查看密码用 `Taro.showModal` 展示并提供复制。
- [ ] 到期提醒：后续接订阅消息模板、授权状态、定时扫描与发送日志。
- [ ] 小程序 AI 开发模式预研：关注微信“小程序 AI 开发模式（beta）”，参考官方 Demo `wechat-miniprogram/ai-mode-demo`，评估将 AI 资讯、会员中心、AI 工具封装为 SKILL/原子接口/原子组件；该能力当前暂未开放代码提审，相关代码只能放实验分支或实验目录，不能合入正式审核版本。

### 验收检查点

- 登录缓存：清除本地缓存后进入首页必弹登录窗，授权成功后刷新不再弹。
- 登录缓存字段：`gpt_pay_user_info` 需要包含 `userId/openId/openid/nickname/avatarUrl`，旧缓存缺 `openId/openid` 时进入首页或会员中心会尝试调用 `user-login` 补齐。
- 会员状态：未购买显示 `立即开通`，已支付未处理显示 `开通中`，处理完成显示 `已开通`。
- 会员计时：有效期从后台处理完成时间开始计算 30 天。
- 积分幂等：订单回调重复不会重复返还积分或重复抵扣。
- 服务记录：只展示当前用户订单，空状态、处理中、已开通、已失效状态可区分。
- 邀请分享：邀请页点击 `立即邀请好友` 使用微信原生分享，分享路径携带 `inviteCode`。
- 邀请绑定：被邀请用户通过分享路径首次授权登录后，`users.inviterUserId` 与 `invite_relations` 会写入且不能重复绑定/自邀。
- 邀请返积分：被邀请用户支付成功后，邀请人增加积分并写入 `points_ledger`；重复支付回调不重复返还。

### 当前需部署云函数

- `user-login`：返回并补齐本地缓存所需的 `openId/openid`，同步微信昵称、头像、邀请码、积分与 AI 账号注册状态。
- `save-ai-account`：新增 AI 账号注册能力，账号前缀自动拼接 `@mraclpivot.com`，并保存到 `users.aiAccount*` 字段。
- `bind-mobile`：确认手机号授权链路使用 `openapi.phonenumber.getPhoneNumber`，需要带 `config.json` 权限声明并云端安装依赖。
- `get-member-home`：返回 AI 账号注册状态兜底与会员状态；会员中心不承载待支付状态。
- `list-orders`：服务记录页从订单表读取当前用户订单，待支付订单只在订单列表/详情里展示。
- `get-pay-result`：服务详情返回订单金额、套餐、待支付有效期与是否可继续支付。
- `create-order`：每次新生单前关闭当前用户所有待支付订单，保证一个用户最多只有一个待支付订单。
- `pay-order`：仅允许 30 分钟内待支付订单继续支付，超时自动关闭并提示重新下单。
- `get-invite-home`：邀请页读取当前用户邀请码、邀请人数、积分余额、累计返还积分和被邀请人列表。
- `user-login`：新增分享 `inviteCode` 绑定邀请关系逻辑。
- `pay-notify` / `pay-order`：支付完成后复用会员开通逻辑，并为邀请人幂等返积分。

### 支付回调排查

- 订单已有 `prepayId` 但 `payStatus` 仍为 `pending`，说明统一下单成功，问题集中在支付回调没有成功执行 `pay-notify`；待支付订单不会在会员中心展示，只在服务记录/服务详情展示。
- 优先检查 `pay-order` 云函数环境变量 `WX_PAY_NOTIFY_URL` 是否指向当前环境的 `pay-notify` HTTP 访问地址。
- 优先检查 `pay-notify` 云函数日志是否出现 `wechatPay.v2.notify.received`、`signFailed`、`amountMismatch` 或 `orderMissing`。
- `pay-notify` 也必须云端安装依赖，并配置与下单一致的 `WX_PAY_API_KEY`，否则验签会失败或函数启动失败。

### 云函数部署注意

- 先运行 `node scripts/build-cloudfunctions.mjs` 生成项目内 `cloudfunctions-deploy/`；微信开发者工具的 `cloudfunctionRoot` 指向该目录。
- `cloudfunctions/` 是 TypeScript 源码目录，不能直接作为正式云函数上传；上传时选择 `cloudfunctions-deploy/` 下的具体函数目录。
- 上传时确保 `save-ai-account` 已在 `scripts/build-cloudfunctions.mjs` 和 `scripts/upload-cloudfunctions.mjs` 的函数清单里。
- 推荐在微信开发者工具或云开发控制台执行“上传并部署：云端安装依赖”；如果用脚本上传，需要等价启用远程 npm 安装。
- 如果仍报 `FUNCTION_NOT_FOUND`，优先检查目标环境是否存在该函数，以及小程序 `cloud.init` 的 `env` 是否为 `cloud1-d3gbrpive8611514c`。
- 如果报 `Cannot find module 'wx-server-sdk'`，说明代码已上传但依赖未安装，需要重新以云端安装依赖方式部署该函数。
