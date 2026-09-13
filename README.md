# SL2Together

《杀戮尖塔 2》MOD 设计收集与 AI 可行性评估微信小程序。

正式项目位于当前仓库：

```text
C:\Users\akaset\Desktop\sl2_xcx
```

`C:\Users\akaset\WeChatProjects\miniprogram-1` 是官方 QuickStart 模板，只用于验证云环境。正式开发请用微信开发者工具导入当前仓库，不要继续在 QuickStart 页面堆业务代码。

## 已实现

- 微信云开发身份初始化
- 十类 MOD 设计表单
- 草稿保存、编辑、提交、软删除，提交与评估解耦
- 我的提交列表与筛选
- 提交详情和评估过期判断
- Mock AI 可行性评估
- OpenAI 兼容接口适配层
- 评估任务、重试和每日额度基础结构
- 数据库集合初始化云函数

## 首次运行

1. 按 [cloud-development-setup.md](docs/cloud-development-setup.md) 开通云开发环境。
2. 将环境 ID 写入 `miniprogram/config/env.ts`。
3. 在微信开发者工具中导入本仓库。
4. 右键 `cloudfunctions/api`、`adminApi`、`evaluationRunner`、`scheduledWorker`、`systemInit`，选择“上传并部署：云端安装依赖”。
5. 在云函数测试面板调用 `systemInit`，参数为 `{"action":"init"}`。
6. 编译小程序，先完整走一遍“新建 -> 保存并评估 -> 返回修改或确认提交 -> 查看历史”。

## 环境变量

开发环境建议：

```text
APP_ENV=dev
AI_PROVIDER=mock
AI_MODEL=mock-v1
MAX_DAILY_EVALUATIONS=20
CATALOG_VERSION=sts2-api-2026.09-r4
PROMPT_VERSION=eval-v4
```

真实模型使用 `AI_PROVIDER=openai-compatible`，并配置 `AI_BASE_URL`、`AI_API_KEY`、`AI_MODEL`。Key 不得写入仓库或小程序代码。

## 检查命令

```powershell
npm run check:cloud
npm run check:miniprogram
npm run knowledge:build
npm run knowledge:check
npm test
```

## 文档

- `docs/wechat-mod-design-platform-design.md`
- `docs/technical-architecture-and-development-guide.md`
- `docs/pre-development-and-ai-environment-checklist.md`
- `docs/cloud-development-setup.md`
- `docs/database-schema.md`
- `docs/ai-provider-and-knowledge-base.md`
- `docs/admin-data-export.md`
