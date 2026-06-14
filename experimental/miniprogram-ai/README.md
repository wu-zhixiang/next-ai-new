# 小程序 AI 开发模式实验区

本目录用于微信“小程序 AI 开发模式（beta）”预研。

## 状态

- 仅实验使用。
- 不进入正式小程序构建。
- 不进入正式审核版本。
- 官方未开放代码提审前，不允许把本目录接入正式页面或正式构建链路。

## 参考

- 官方 Demo：`wechat-miniprogram/ai-mode-demo`
- AI 工具架构方案：[../../docs/ai-tools-wechat-ai-architecture.md](../../docs/ai-tools-wechat-ai-architecture.md)
- 旧版开发方案：[../../docs/wechat-ai-skills-development-plan.md](../../docs/wechat-ai-skills-development-plan.md)
- 调研文档：[../../docs/wechat-skills.md](../../docs/wechat-skills.md)

## 计划 Skill

```text
skills/
  ai-tools-skill/
    SKILL.md
    mcp.json
    apis/
    components/
  news-skill/
    SKILL.md
    mcp.json
    apis/
    components/
  summary-skill/
    SKILL.md
    mcp.json
    apis/
    components/
  member-skill/
    SKILL.md
    mcp.json
    apis/
    components/
```

## 安全边界

允许预研：

- AI 资讯查询。
- 摘要总结。
- 用户自己的会员状态查询。

禁止暴露：

- 账号密码明文。
- 邮箱验证码。
- Apple Store 账号池。
- 运营插件接口。
- 订单开通流程。
