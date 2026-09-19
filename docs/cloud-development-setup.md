# 微信云开发启用与部署步骤

本文档对应 2026-09-11 的微信开发者工具和微信云开发基础流程。界面名称可能随工具版本略有变化，但操作顺序不变。

## 1. 先在 QuickStart 模板验证云环境

打开：

```text
C:\Users\akaset\WeChatProjects\miniprogram-1
```

这个项目已经带有 AppID `wx84303723949df19a`，适合先验证云开发。

1. 用管理员微信登录微信开发者工具。
2. 打开 QuickStart 项目。
3. 点击工具栏顶部的“云开发”。
4. 如果提示开通，按引导创建环境。
5. 开发环境建议命名 `sts2-mod-dev`。
6. 套餐先选择适合开发和测试的套餐，确认免费额度、计费和资源限制。
7. 开通后复制环境 ID，它通常类似 `sts2-mod-dev-1g2h3i4j5k6l`。
8. 在 QuickStart 中部署一个示例云函数并调用成功，确认云函数、数据库和日志均可用。

到这里，云数据库才算真正启用。单纯创建小程序项目不会自动开启云开发。

## 2. 导入正式项目

回到仓库：

```text
C:\Users\akaset\Desktop\sl2_xcx
```

1. 微信开发者工具选择“导入项目”。
2. 项目目录选择上面的仓库。
3. AppID 使用 `wx84303723949df19a`，或替换成你自己的正式 AppID。
4. 打开后确认工具识别到 `miniprogram/` 和 `cloudfunctions/`。
5. 打开 `miniprogram/config/env.ts`，把 `ENV_ID` 改成刚才复制的环境 ID。

```ts
export const ENV_ID = 'sts2-mod-dev-1g2h3i4j5k6l';
```

## 3. 部署云函数

在微信开发者工具左侧展开 `cloudfunctions`，依次右键以下目录：

1. `api`
2. `adminApi`
3. `evaluationRunner`
4. `scheduledWorker`
5. `systemInit`

选择“上传并部署：云端安装依赖”，等待部署成功。

`systemInit` 只用于开发生成集合和知识库版本。正式环境也可以保留，但必须配置 `INIT_SECRET`。

## 4. 初始化数据库

在微信开发者工具中右键 `systemInit`，选择“云函数本地调试”或打开云开发控制台的函数测试。

测试参数：

```json
{
  "action": "init"
}
```

如果已经配置 `INIT_SECRET`，参数改为：

```json
{
  "action": "init",
  "secret": "你的初始化密钥"
}
```

云函数会创建：

- `users`
- `submissions`
- `share_codes`
- `evaluations`
- `evaluation_jobs`
- `mod_generation_jobs`
- `catalog_versions`
- `usage_daily`
- `admins`
- `admin_audit_logs`

并写入一条 `catalog_versions` 记录。

## 5. 设置数据库权限

进入云开发控制台 -> 数据库 -> 集合 -> 权限设置。

核心业务集合建议统一设置为仅云函数可读写：

```json
{
  "read": false,
  "write": false
}
```

云函数使用管理员权限，不受客户端安全规则限制。小程序客户端不得直接读写 `submissions`、`evaluations`、`evaluation_jobs` 等核心集合。

如果控制台只提供预设权限，选择“仅管理员可读写”或等价选项。

## 6. 创建索引

在云开发控制台为以下集合创建索引：

| 集合 | 字段 |
| --- | --- |
| `submissions` | `_openid` 升序 + `deletedAt` 升序 + `updatedAt` 降序 |
| `submissions` | `_openid` 升序 + `deletedAt` 升序 |
| `submissions` | `_openid` 升序 + `deletedAt` 升序 + `status` 升序 + `updatedAt` 降序 |
| `submissions` | `_openid` 升序 + `deletedAt` 升序 + `evaluationStatus` 升序 + `updatedAt` 降序 |
| `submissions` | `_openid` 升序 + `deletedAt` 升序 + `evaluationStatus` 升序 |
| `submissions` | `_openid` 升序 + `deletedAt` 升序 + `type` 升序 + `updatedAt` 降序 |
| `submissions` | `_openid` 升序 + `deletedAt` 升序 + `latestEvaluation.difficulty.level` 升序 + `updatedAt` 降序 |
| `share_codes` | `code` 升序 |
| `evaluations` | `_openid` 升序 + `submissionId` 升序 + `createdAt` 降序 |
| `evaluation_jobs` | `_openid` 升序 + `submissionId` 升序 + `createdAt` 降序 |
| `evaluation_jobs` | `status` 升序 + `createdAt` 升序 |
| `mod_generation_jobs` | `_openid` 升序 + `submissionId` 升序 + `createdAt` 降序 |
| `usage_daily` | `_openid` 升序 + `date` 升序 |
| `catalog_versions` | `status` 升序 + `updatedAt` 降序 |

至少先创建前六组，否则首页统计、记录列表和筛选查询可能报索引缺失。

## 7. 配置云函数环境变量

`api`：

先将 `api` 云函数的“执行超时”设置为 `60` 秒。生成 MOD 需要调用云托管完成编译，默认 20 秒不足。

```text
APP_ENV=dev
AI_PROVIDER=openai-compatible
AI_MODEL=qwen3.8-flash
CATALOG_VERSION=sts2-api-2026.09-r4
PROMPT_VERSION=eval-v4
MAX_DAILY_EVALUATIONS=20
MOD_BUILDER_URL=https://你的云托管访问地址/sl2modc/build
MOD_BUILD_TOKEN=与云托管容器完全一致的随机长字符串
STS2_REFERENCE_FILE_ID=cloud://你的环境ID/mod-build/reference-kit/reference-kit.zip
MOD_BUILDER_TIMEOUT_MS=45000
```

`api` 不保存 API Key，但 `AI_PROVIDER`、`AI_MODEL`、`CATALOG_VERSION` 和 `PROMPT_VERSION` 必须与 `evaluationRunner` 保持一致，否则会创建旧 Provider 的任务或错误复用缓存。

`evaluationRunner`：

先将云函数“执行超时”设置为 `60` 秒。模型调用属于外部网络请求，3 秒的默认值不足以完成真实评估。

```text
APP_ENV=dev
AI_PROVIDER=mock
AI_MODEL=mock-v1
AI_BASE_URL=
AI_API_KEY=
AI_TIMEOUT_MS=30000
AI_JSON_MODE=true
AI_MAX_COMPLETION_TOKENS=800
AI_ENABLE_THINKING=false
CATALOG_VERSION=sts2-api-2026.09-r4
PROMPT_VERSION=eval-v4
INTERNAL_TASK_TOKEN=一段随机长字符串
```

`scheduledWorker`：

```text
INTERNAL_TASK_TOKEN=与 evaluationRunner 完全一致
```

`systemInit`：

```text
APP_ENV=dev
INIT_SECRET=一段随机长字符串
CATALOG_VERSION=sts2-api-2026.09-r4
```

`AI_API_KEY` 绝不能进入小程序代码、仓库、数据库或日志。

管理员初始化、用户数据筛选和导出见 `docs/admin-data-export.md`。

## 8. 接入真实模型

确定服务商后配置：

```text
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://你的服务商/v1
AI_MODEL=你的模型名
AI_API_KEY=你的密钥
```

当前适配层使用 OpenAI 兼容的 `/chat/completions` 接口。正式接入前先使用独立开发 Key，并设置消费限额和告警。

## 9. 首次验收流程

1. 编译小程序，首页能显示当前用户身份。
2. 新建一张卡牌，填写名称和至少 15 个字符的描述。
3. 保存草稿，详情页显示“草稿”。
4. 在编辑页点击“保存并评估”，不需要先提交。
5. 评估完成后显示四档难度、原因、风险、建议和技术依据。
6. 在评估报告页可以选择“返回修改”或“满意，确认提交”。
7. 在“提交记录”中能按类型、设计状态、评估状态和难度筛选。
8. 修改设计后，旧评估显示已过期。
9. 删除记录后，普通列表不再显示。
10. 在详情页生成分享标识，再用另一个微信用户进入首页“导入分享”，确认可以保存为独立草稿。

## 10. 常见问题

### 调用云函数提示找不到环境

检查 `miniprogram/config/env.ts` 是否填写环境 ID，并确认该环境属于当前 AppID。

### 提示 collection not exists

重新部署并调用 `systemInit`。如果仍然失败，确认云开发控制台中的数据库服务已开通。

### 提示缺少索引

按本文第 6 节创建索引。索引创建后可能需要等待几分钟生效。

### 评估一直停在评估中

确认 `evaluationRunner` 已部署，`AI_PROVIDER=mock` 时不需要 API Key。检查云函数日志中的 `jobId` 和错误码。
