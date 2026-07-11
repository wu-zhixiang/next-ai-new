# AI 会员管理后台

React + React Router + TypeScript + Vite 管理后台项目，使用 `HashRouter`，适合部署到腾讯云 CloudBase 静态网站托管。

## 本地开发

```bash
npm install
npm run dev
```

也可以在仓库根目录执行：

```bash
npm run admin:dev
```

本地服务会绑定到 `http://127.0.0.1:5174/`。开发环境下前端会强制使用 `/admin-api`，即使浏览器 localStorage 里还保存着旧的云函数完整地址，请求也会打到本机 Vite dev server，再由 Vite 代理转发。

## 构建

```bash
npm run build
```

构建产物输出到 `admin/dist`。

## 环境变量

复制 `.env.example` 为 `.env.local`。本地开发建议让浏览器请求打到 Vite 本机地址，再由 Vite 转发到真实云函数：

```bash
VITE_ADMIN_API_BASE_URL=/admin-api
ADMIN_API_PROXY_TARGET=https://your-cloudbase-http-domain.com/wechat/admin-api
```

`VITE_ADMIN_API_BASE_URL` 会进入浏览器包，本地填 `/admin-api` 即可。`ADMIN_API_PROXY_TARGET` 只由 Vite dev server 读取，不会进入浏览器包。它可以填完整 `.../admin-api`，也可以填云函数 HTTP 域名前缀，Vite 会把本地 `/admin-api/users` 转发到远端对应接口。

不要把生产长期密钥写入 Vite 环境变量。当前登录页用于本地测试真实云函数接口：页面本地运行，访问 `/admin-api/...`，由 Vite 代理到已部署并开启 HTTP 访问的 `admin-api` 云函数。

## CloudBase 静态托管

推荐构建后上传 `admin/dist` 到 CloudBase 静态网站托管。当前路由使用 `HashRouter`，刷新页面不会依赖服务端 fallback 配置。

可选 CLI 流程：

```bash
npm run build
tcb hosting deploy ./dist -e <env-id>
```

或者在根目录使用 CloudBase 应用部署时，将项目目录指向 `admin`，构建命令设为 `npm run build`，输出目录设为 `dist`。

## 后端接口

前端已接入 `cloudfunctions/admin-api`，本地测试前需要：

1. 构建并部署 `admin-api` 云函数。
2. 在云开发控制台开启 `admin-api` HTTP 访问。
3. 配置云函数环境变量 `ADMIN_API_TOKEN`，也可以临时复用已有 `OPERATOR_API_TOKEN`。
4. 如需部署到静态托管正式域名，配置 `ADMIN_ALLOWED_ORIGINS`，多个来源用英文逗号分隔。

当前接口约束：

- 用户：支持列表、编辑、删除，不支持后台新增。
- 订单：支持列表、编辑、删除，不支持后台新增。
- AI 新闻：支持列表、新增、编辑、删除。
- AI 工具：支持列表、新增、编辑、删除，数据存储在 `ai_tools` 集合。
- 所有删除接口都要求请求体携带 `{"confirm":"DELETE"}`，前端也会先弹出二次确认。

接口路径：

- `GET /users`、`PATCH /users/:id`、`DELETE /users/:id`
- `GET /orders`、`PATCH /orders/:id`、`DELETE /orders/:id`
- `GET /news`、`POST /news`、`PATCH /news/:id`、`DELETE /news/:id`
- `GET /tools`、`POST /tools`、`PATCH /tools/:id`、`DELETE /tools/:id`

正式接口需要统一做管理员鉴权、CORS 域名限制、输入校验、分页、审计日志和敏感操作二次确认。
