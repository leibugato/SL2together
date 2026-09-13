# 微信小程序 MOD 设计平台技术架构与开发指南

## 0. 文档信息

| 项目 | 内容 |
| --- | --- |
| 文档版本 | v0.1 |
| 状态 | 技术基线，用于后续开发与 AI 编码协作 |
| 更新日期 | 2026-09-11 |
| 关联文档 | `docs/wechat-mod-design-platform-design.md` |
| 首版目标 | 完成提交、AI 评估、历史记录和管理员查看的完整闭环 |

本文档用于确定技术栈、项目初始化方式、代码结构、云端数据存储、管理员访问方式和后续 AI 开发约束。

---

## 1. 技术决策摘要

首版采用以下方案：

| 模块 | 选择 |
| --- | --- |
| 客户端 | 原生微信小程序 |
| 客户端语言 | TypeScript |
| 开发工具 | 微信开发者工具 + Visual Studio Code |
| 后端 | 微信云开发 CloudBase 云函数 |
| 数据库 | 微信云开发云数据库 |
| 文件存储 | 微信云开发云存储 |
| AI 调用 | 云函数服务端调用，OpenAI 兼容适配层 |
| 结构化校验 | Zod 或等价 JSON Schema 校验库 |
| 管理员后台 | 小程序内隐藏管理页 + 云开发控制台兜底 |
| Git 仓库 | 已初始化的当前仓库 |
| Visual Studio | 首版不使用 |

核心原则：

1. 所有 AI API Key 只存在于云函数环境变量中。
2. 客户端不直接访问核心业务数据库。
3. 所有写操作由云函数执行服务端校验。
4. 提交正文和评估结果分离存储。
5. AI 输出必须是受 Schema 约束的结构化结果。
6. 开发环境与生产环境必须使用不同云开发环境。

---

## 2. 为什么选择这套技术栈

### 2.1 原生微信小程序

适合首版的原因：

1. 项目只面向微信，不需要跨端。
2. 可以直接使用微信登录和云开发身份体系。
3. 微信开发者工具能够完成调试、预览、上传和云函数部署。
4. 微信审核路径和官方能力接入最直接。
5. 比 Taro、uni-app 等跨端方案少一层构建复杂度。

首版不建议使用跨端框架。

### 2.2 TypeScript

TypeScript 用于：

1. 固定十种内容类型。
2. 固定提交状态和评估状态。
3. 约束云函数输入输出。
4. 约束 AI 评估结果结构。
5. 降低页面、云函数和数据库字段不一致的风险。

### 2.3 微信云开发

首版使用微信云开发的原因：

1. 不需要购买和维护服务器。
2. 云函数可以直接从上下文获取调用者 `OPENID`。
3. 云数据库、云存储、云函数和控制台在一个环境内。
4. 可以把 AI Key 放在云函数环境变量中。
5. 管理员可以直接在云开发控制台查看数据库和日志。
6. 后续如果规模增大，可以逐步迁移到腾讯云 CloudBase 或自建后端。

### 2.4 暂不使用自建后端

以下方案适合未来扩展，但不应作为首版起点：

| 方案 | 使用时机 |
| --- | --- |
| NestJS + PostgreSQL | 多端产品、复杂权限、复杂事务 |
| Go 服务 | 高并发、独立部署和精细控制 |
| ASP.NET Core | 需要统一 C# 技术栈或复杂 Windows 集成 |
| Python 服务 | AI 管线和模型服务是核心业务时 |

当前需求以 CRUD、异步评估和简单管理为主，自建后端会增加服务器、域名、HTTPS、备案、鉴权和运维成本。

---

## 3. VSCode、Visual Studio 与微信开发者工具如何配合

### 3.1 推荐组合

使用：

1. 微信开发者工具：创建小程序、预览、真机调试、云函数部署和云数据库查看。
2. Visual Studio Code：主要编码、Git、搜索、终端和 AI 辅助开发。
3. Visual Studio 2022：首版不需要。

Visual Studio 是 .NET 和 C# 开发环境。只有当项目后续新增独立的 ASP.NET Core 后端服务时才有必要使用。微信小程序页面、TypeScript、云函数和云开发数据库不需要 Visual Studio。

### 3.2 VSCode 建议扩展

可选：

1. ESLint
2. Prettier
3. GitLens
4. Error Lens
5. Markdown All in One

微信小程序的运行、预览和云函数部署仍以微信开发者工具为准，不建议依赖第三方兼容插件替代官方工具。

---

## 4. 是否需要使用模板创建新项目

需要使用官方模板，但建议分两步。

### 4.1 第一步：用云开发快速模板验证环境

在微信开发者工具中创建一个临时的“云开发 QuickStart”或“云开发基础模板”项目，用于验证：

1. 小程序账号和 AppID 是否正常。
2. 云开发环境是否已经开通。
3. 云函数能否部署和调用。
4. 云数据库能否正常读写。
5. 当前开发者账号是否具有云开发控制台权限。

这个项目只用于环境验证，可以包含官方示例用户、计数器或示例数据库集合。

### 4.2 第二步：正式项目使用 TypeScript 小程序模板

正式项目仍创建在当前 Git 仓库 `C:\Users\akaset\Desktop\sl2_xcx` 中：

1. 使用微信开发者工具新建“小程序”项目。
2. 选择 TypeScript 模板。
3. 不选择 JavaScript 基础模板。
4. 关联已经注册的微信小程序 AppID。
5. 选择已经创建的云开发环境。
6. 将正式小程序代码放入 `miniprogram/`。
7. 将云函数代码放入 `cloudfunctions/`。
8. 删除官方模板中不需要的示例页面和示例数据。

不建议把 QuickStart 示例直接作为生产项目继续开发，因为它会留下示例页面、示例集合和演示代码，增加整理成本。

### 4.3 推荐的初始化结果

```text
sl2_xcx/
├── docs/
├── miniprogram/
│   ├── app.ts
│   ├── app.json
│   ├── app.wxss
│   ├── components/
│   ├── config/
│   ├── pages/
│   ├── services/
│   ├── stores/
│   ├── types/
│   └── utils/
├── cloudfunctions/
│   ├── api/
│   ├── evaluationRunner/
│   ├── adminApi/
│   └── scheduledWorker/
├── scripts/
├── project.config.json
├── package.json
├── tsconfig.json
└── README.md
```

### 4.4 关键项目配置

`project.config.json` 需要设置类似以下路径：

```json
{
  "appid": "你的微信小程序AppID",
  "projectname": "sl2-mod-design-platform",
  "compileType": "miniprogram",
  "miniprogramRoot": "miniprogram/",
  "cloudfunctionRoot": "cloudfunctions/"
}
```

具体字段会随微信开发者工具版本变化，以工具生成的配置为准。

---

## 5. 总体架构

```text
微信客户端
  |
  | wx.cloud.callFunction
  v
云函数 API 层
  |
  +--> 用户身份校验
  +--> 参数校验
  +--> 内容安全检查
  +--> 数据库读写
  +--> 评估任务创建
  |
  +-------------------------+
  |                         |
  v                         v
云数据库                  云存储
  |                         |
  |                         +--> 用户上传的图片或音频
  +--> users
  +--> submissions
  +--> evaluations
  +--> evaluation_jobs
  +--> usage_daily
  +--> admins
  +--> catalog_versions
  |
  v
评估执行云函数
  |
  +--> 规则预判
  +--> 知识片段检索
  +--> AI Provider Adapter
  +--> JSON Schema 校验
  +--> 结果写回
```

### 5.1 请求链路

1. 小程序调用云函数。
2. 云函数从上下文读取 `OPENID`。
3. 云函数完成身份、参数和权限校验。
4. 业务数据写入云数据库。
5. AI 评估通过任务状态异步推进。
6. 客户端轮询评估状态或重新进入详情页。
7. 管理员通过管理云函数或云开发控制台查看。

### 5.2 AI 请求链路

1. `evaluation.start` 校验提交并创建 `evaluation_jobs`。
2. 客户端调用 `evaluationRunner`，或者由定时任务拾取待处理任务。
3. 执行器使用原子锁将任务从 `QUEUED` 更新为 `RUNNING`。
4. 规则引擎生成基础标签和维度参考分。
5. 知识检索器读取对应接口知识片段。
6. 模型适配器调用 AI 服务。
7. 输出经过 Schema 校验、长度限制和内容安全检查。
8. 写入 `evaluations`，更新 `submissions`。

定时任务只处理超时任务、重试任务和未被拾取的队列任务，不能成为唯一的正常处理路径。

---

## 6. 云开发环境设计

### 6.1 环境划分

至少创建两个云开发环境：

| 环境 | 用途 |
| --- | --- |
| `sts2-mod-dev` | 本地开发、测试、调试和云函数预发布 |
| `sts2-mod-prod` | 正式用户数据和生产 AI 调用 |

不要在生产环境直接调试页面或测试数据库结构。

### 6.2 环境配置

小程序端公开配置可以包含：

```ts
export const ENV_ID = "sts2-mod-dev";
```

云函数环境变量可以包含：

```text
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
AI_TIMEOUT_MS=30000
MAX_DAILY_EVALUATIONS=10
```

约束：

1. `AI_API_KEY` 不进入小程序代码。
2. 环境变量不提交到 Git。
3. 开发和生产环境使用不同 Key。
4. 生产 Key 设置调用限额和告警。
5. 日志中不输出完整 Key 和完整用户设计正文。

---

## 7. 目录与代码边界

### 7.1 小程序端

| 目录 | 职责 |
| --- | --- |
| `pages/` | 页面和页面生命周期 |
| `components/` | 表单字段、评估标签、状态卡片等复用组件 |
| `services/` | 云函数调用封装 |
| `stores/` | 当前用户、草稿和页面共享状态 |
| `types/` | 类型、状态和接口定义 |
| `utils/` | 日期、校验、哈希、错误转换等纯函数 |
| `config/` | 云环境 ID、功能开关和常量 |

页面不直接拼接数据库字段，不直接调用 AI，也不直接写云数据库。

### 7.2 云函数

| 云函数 | 职责 |
| --- | --- |
| `api` | 用户、提交、查询、删除等常规业务 |
| `evaluationRunner` | 执行规则评估、AI 调用和结果写入 |
| `adminApi` | 管理员查询、审核、重试和导出 |
| `scheduledWorker` | 清理过期任务、重试和统计 |

如果云函数部署数量过多，可以先把 `api` 和 `adminApi` 保持独立，避免管理员逻辑混入普通用户接口。

### 7.3 共享协议

首版可以通过 TypeScript 类型和 JSON Schema 维护协议，不必立即建设复杂 monorepo。

必须固定的协议：

1. 十种内容类型。
2. 提交状态。
3. 评估任务状态。
4. 四档难度枚举。
5. 云函数统一响应结构。
6. 错误码。

禁止在页面、云函数和数据库中分别维护不同版本的枚举。

---

## 8. 云端数据如何存储

### 8.1 数据库类型

微信云数据库是文档型数据库。每条记录是 JSON 文档，不要求所有提交拥有完全相同的 `extra` 字段。

公共字段使用固定结构，类型特有字段放在 `extra` 对象中：

```json
{
  "type": "CARD",
  "name": "飞刀连击",
  "designText": "对指定敌人造成 6 点伤害，如果本回合已经打出过攻击牌，则再造成一次伤害。",
  "resourceUrl": "",
  "extra": {
    "cost": 1,
    "cardType": "Attack",
    "rarity": "Common"
  }
}
```

### 8.2 主要集合

#### `users`

保存用户身份和基础状态：

```json
{
  "_id": "user_xxx",
  "_openid": "openid_xxx",
  "nickname": "",
  "avatarUrl": "",
  "status": "active",
  "createdAt": "serverDate",
  "updatedAt": "serverDate"
}
```

#### `submissions`

保存设计主体和最新状态：

```json
{
  "_id": "submission_xxx",
  "_openid": "openid_xxx",
  "type": "BUFF",
  "name": "战斗狂热",
  "designText": "每消耗一张攻击牌获得一层战斗狂热。",
  "resourceUrl": "",
  "extra": {
    "powerType": "Buff",
    "stackType": "Counter",
    "duration": "Combat"
  },
  "status": "DRAFT",
  "evaluationStatus": "SUCCEEDED",
  "contentVersion": 1,
  "contentHash": "sha256_xxx",
  "latestEvaluationId": "evaluation_xxx",
  "createdAt": "serverDate",
  "updatedAt": "serverDate"
}
```

#### `evaluations`

每次评估独立保存，不覆盖历史：

```json
{
  "_id": "evaluation_xxx",
  "_openid": "openid_xxx",
  "submissionId": "submission_xxx",
  "contentVersion": 1,
  "contentHash": "sha256_xxx",
  "difficulty": {
    "level": "MEDIUM",
    "label": "中等",
    "score": 46,
    "confidence": 0.78,
    "provisional": false
  },
  "summary": "需要新增 Power，但主要钩子可以复用现有回调。",
  "implementationBrief": "使用状态模型承载效果，触发时机接入现有战斗回调，界面读取统一状态。",
  "reasons": [],
  "risks": [],
  "suggestions": [],
  "missingInformation": [],
  "technicalAnchors": [],
  "dimensions": {},
  "model": {
    "provider": "configured_provider",
    "model": "configured_model",
    "promptVersion": "eval-v4",
    "catalogVersion": "sts2-api-2026.09-r4"
  },
  "createdAt": "serverDate"
}
```

#### `evaluation_jobs`

保存异步任务和幂等状态：

```json
{
  "_id": "job_xxx",
  "_openid": "openid_xxx",
  "submissionId": "submission_xxx",
  "contentHash": "sha256_xxx",
  "status": "QUEUED",
  "attempts": 0,
  "maxAttempts": 3,
  "lockedAt": null,
  "errorCode": null,
  "createdAt": "serverDate",
  "updatedAt": "serverDate"
}
```

#### `admins`

管理员权限不写在客户端，也不硬编码在页面中：

```json
{
  "_id": "admin_xxx",
  "_openid": "管理员openid",
  "role": "SUPER_ADMIN",
  "status": "ACTIVE",
  "createdAt": "serverDate"
}
```

角色建议：

| 角色 | 权限 |
| --- | --- |
| `SUPER_ADMIN` | 全部管理权限 |
| `MODERATOR` | 查看、审核、隐藏内容 |
| `VIEWER` | 只读查看 |

#### `admin_audit_logs`

记录管理员操作：

```json
{
  "_id": "audit_xxx",
  "_openid": "管理员openid",
  "action": "RE_EVALUATE",
  "targetId": "submission_xxx",
  "result": "SUCCESS",
  "createdAt": "serverDate"
}
```

### 8.3 推荐索引

在云开发控制台为以下查询创建索引：

| 集合 | 索引 |
| --- | --- |
| `submissions` | `_openid` 升序 + `updatedAt` 降序 |
| `submissions` | `status` 升序 + `createdAt` 降序 |
| `submissions` | `type` 升序 + `updatedAt` 降序 |
| `evaluations` | `submissionId` 升序 + `contentVersion` 降序 |
| `evaluation_jobs` | `status` 升序 + `createdAt` 升序 |
| `usage_daily` | `_openid` 升序 + `date` 升序 |
| `catalog_versions` | `status` 升序 + `createdAt` 降序 |

没有索引的分页和筛选查询在数据量增长后会明显变慢。

### 8.4 数据生命周期

1. 提交先保存为草稿。
2. 删除使用软删除，保留恢复可能。
3. 评估结果不可覆盖，只追加新版本。
4. 任务失败记录保留错误码。
5. 每日用量到期后按策略聚合或清理。
6. 管理员审计日志保留时间应长于普通业务日志。

---

## 9. 云函数接口规范

### 9.1 统一响应

成功：

```json
{
  "ok": true,
  "data": {},
  "requestId": "req_xxx"
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "描述与设计至少需要 20 个字符。",
    "retryable": false
  },
  "requestId": "req_xxx"
}
```

### 9.2 错误码

| 错误码 | 含义 |
| --- | --- |
| `UNAUTHENTICATED` | 无法识别用户 |
| `FORBIDDEN` | 无权访问 |
| `VALIDATION_ERROR` | 请求参数不合法 |
| `NOT_FOUND` | 记录不存在 |
| `CONFLICT` | 并发版本冲突 |
| `RATE_LIMITED` | 达到频率限制 |
| `CONTENT_REJECTED` | 内容安全检查拒绝 |
| `AI_TIMEOUT` | AI 调用超时 |
| `AI_INVALID_OUTPUT` | AI 输出不符合 Schema |
| `INTERNAL_ERROR` | 未分类内部错误 |

### 9.3 普通用户接口

| Action | 用途 |
| --- | --- |
| `user.bootstrap` | 创建或读取当前用户 |
| `idea.create` | 创建草稿或提交 |
| `idea.update` | 更新并生成内容版本 |
| `idea.listMine` | 查询自己的历史记录 |
| `idea.getMine` | 查询自己的详情 |
| `idea.deleteMine` | 软删除 |
| `evaluation.start` | 创建评估任务 |
| `evaluation.get` | 查询任务或评估结果 |
| `evaluation.retry` | 重试失败任务 |

### 9.4 管理员接口

| Action | 用途 |
| --- | --- |
| `admin.dashboard` | 查看汇总数据 |
| `admin.listSubmissions` | 查询全部提交 |
| `admin.getSubmission` | 查看提交详情 |
| `admin.hideSubmission` | 隐藏违规内容 |
| `admin.restoreSubmission` | 恢复内容 |
| `admin.reEvaluate` | 重新执行评估 |
| `admin.exportSubmissions` | 导出 CSV 或 JSON |
| `admin.listJobs` | 查看失败和积压任务 |
| `admin.updateUserStatus` | 封禁或恢复用户 |

所有管理员接口必须再次验证数据库中的 `admins` 记录，不能只判断客户端页面是否可进入。

---

## 10. AI 评估的技术实现

### 10.1 规则层

规则层负责：

1. 文本规范化。
2. 类型基线。
3. 关键词和机制标签。
4. 必填信息完整性检查。
5. 风险词和违规内容预判。
6. 初步维度分数。

规则层必须是纯逻辑模块，方便单元测试，不依赖页面状态。

### 10.2 知识层

知识库以游戏接口版本为单位维护：

| 知识片段 | 内容 |
| --- | --- |
| 卡牌 | `CardModel`、动态变量、命令、卡池和本地化 |
| 遗物 | `RelicModel`、稀有度、钩子、图标和描边 |
| 事件 | `EventModel`、页面、选项和章节补丁 |
| 角色 | `CharacterModel`、卡池、遗物池、药水池和场景 |
| 先古之民 | `AncientEventModel`、对话、遗物选项和随机池 |
| 皮肤 | 贴图、立绘、动画和场景替换 |
| 怪物 | `MonsterModel`、意图、移动状态机和遭遇 |
| Boss | 多阶段机制、遭遇池、场景和音乐 |
| 语音 | 音频资源、触发映射、语言和打包 |
| Buff | `PowerModel`、叠加、钩子、持续和状态同步 |

每次评估必须记录 `catalogVersion`。游戏版本变化后，旧结果不自动覆盖，只标记为可能过期。

### 10.3 模型适配层

定义统一接口：

```ts
export interface EvaluationModel {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}
```

实现可以包括：

1. OpenAI 兼容接口。
2. 国内模型服务。
3. 本地或测试用 Mock Provider。
4. 降级用规则 Provider。

业务代码不直接依赖某个厂商 SDK。

### 10.4 输出校验

模型输出必须经过：

1. JSON 解析。
2. 枚举检查。
3. 数值范围检查。
4. 数组长度限制。
5. 技术依据白名单检查。
6. 内容安全检查。
7. 敏感字段过滤。

任何一步失败都不能把原始输出直接展示给用户。

### 10.5 缓存与去重

评估缓存键：

```text
sha256(contentHash + catalogVersion + promptVersion + modelName)
```

在缓存命中时直接复制已有结果，但仍创建一条新的评估引用或复用原评估 ID，避免重复调用模型。

---

## 11. 管理员如何查看数据

管理员有两种查看方式。

### 11.1 云开发控制台

开发阶段和紧急处理阶段，使用微信开发者工具中的“云开发”控制台，或对应 CloudBase 控制台。

可以查看：

1. 数据库集合和记录。
2. 用户提交正文。
3. 评估任务状态。
4. AI 评估结果。
5. 云函数调用日志和错误。
6. 云存储文件。
7. 数据库导入、导出和备份能力。

推荐查看顺序：

```text
云开发控制台
  -> 数据库
  -> submissions
  -> 按 status、type、updatedAt 筛选
  -> 打开单条记录
  -> 通过 latestEvaluationId 查看 evaluations
```

云开发控制台适合开发和紧急排查，不适合作为日常审核界面。

### 11.2 小程序内管理页

生产环境建议增加隐藏管理页：

```text
/pages/admin/index
```

管理页入口不放在普通底部导航中。是否显示页面不构成权限控制，真正的权限判断必须在 `adminApi` 云函数中完成。

管理员功能：

1. 查看提交列表和详情。
2. 按类型、状态和难度筛选。
3. 查看 AI 评估报告。
4. 隐藏、恢复或删除违规提交。
5. 重试失败的评估任务。
6. 查看每日调用量。
7. 导出提交和评估数据。
8. 查看管理员审计日志。

### 11.3 初始管理员如何设置

1. 管理员先用微信登录一次小程序，使 `users` 集合产生记录。
2. 在云开发控制台找到该记录。
3. 复制该用户的 `_openid`。
4. 在 `admins` 集合新增一条 `SUPER_ADMIN` 记录。
5. 重新进入管理页，云函数读取 `admins` 记录后授予权限。

不要在代码中硬编码管理员 `OPENID`。

### 11.4 管理员权限安全

1. 管理端所有查询由云函数执行。
2. 云函数重新判断管理员角色。
3. 只返回管理页面需要的字段。
4. 不展示用户完整 `OPENID`，除非是超级管理员排障场景。
5. 所有敏感操作写入 `admin_audit_logs`。
6. 生产环境不使用开发者账号进行日常用户操作。

---

## 12. 本地开发流程

### 12.1 首次准备

1. 注册微信小程序账号并获取 AppID。
2. 安装微信开发者工具稳定版。
3. 使用管理员微信登录工具。
4. 开通云开发。
5. 创建 `dev` 和 `prod` 两个环境。
6. 在当前 Git 仓库创建 TypeScript 小程序项目。
7. 配置 `miniprogramRoot` 和 `cloudfunctionRoot`。
8. 初始化 npm 和 TypeScript 配置。
9. 创建首批云函数。
10. 创建数据库集合和索引。

### 12.2 日常开发

1. 在 VSCode 编辑代码。
2. 在微信开发者工具预览和调试。
3. 云函数修改后在开发者工具中重新部署。
4. 数据库变更先更新文档和迁移说明。
5. 完成一个可验证闭环后再提交 Git commit。

### 12.3 推荐分支

```text
main
  -> feat/miniprogram-bootstrap
  -> feat/idea-crud
  -> feat/ai-evaluation
  -> feat/admin-console
```

不要在 `main` 分支直接开发大型未验证功能。

---

## 13. 后续 AI 开发规则

后续使用 AI 编码时，要求 AI 先阅读：

1. `docs/wechat-mod-design-platform-design.md`
2. `docs/technical-architecture-and-development-guide.md`
3. 当前目录的 `README.md`
4. 项目实际代码和 `project.config.json`

AI 编码必须遵守：

1. 不把 AI API Key 写入客户端。
2. 不绕过云函数直接由页面写数据库。
3. 不修改已有枚举值，除非同时提供迁移方案。
4. 不把 `extra` 类型字段硬编码到公共提交表。
5. 不信任客户端传入的 `_openid`、`status` 和 `role`。
6. 所有数据库修改都要考虑旧数据兼容。
7. 云函数接口必须保持统一响应格式。
8. AI 评估必须保留 `contentVersion`、`catalogVersion` 和 `promptVersion`。
9. 新的页面必须有加载、空、失败和无权限状态。
10. 每次修改 TypeScript 核心逻辑后执行类型检查和测试。

---

## 14. 测试与质量

### 14.1 纯逻辑测试

使用 Vitest 或 Jest 测试：

1. 表单校验。
2. 内容哈希。
3. 类型基线。
4. 难度分档。
5. AI 输出 Schema 校验。
6. 权限判断。
7. 状态流转。

### 14.2 云函数测试

1. 未登录请求必须被拒绝。
2. 用户不能访问其他用户提交。
3. 管理接口对普通用户返回无权限。
4. 重复评估请求不会重复计费。
5. AI 超时后任务可重试。
6. 模型非法输出不会写入正式结果。

### 14.3 小程序测试

至少覆盖：

1. 真机登录。
2. 十种类型表单切换。
3. 草稿保存和恢复。
4. 评估中状态刷新。
5. 长文本和长资源链接显示。
6. 历史列表分页。
7. 删除和评估过期提示。
8. 管理页无权限状态。

---

## 15. 上线前检查

1. `dev` 和 `prod` 环境完全分离。
2. 生产 AI Key 未出现在客户端和 Git。
3. 数据库安全规则禁止普通客户端跨用户访问。
4. 管理员接口完成服务端鉴权。
5. 内容安全接口已接入。
6. 隐私政策说明 AI 第三方处理。
7. 数据库有索引和备份策略。
8. 云函数日志不会输出完整敏感正文。
9. 用户删除和账号注销路径明确。
10. 游戏接口知识库版本已经固定。

---

## 16. 推荐实施顺序

### 阶段一：项目骨架

1. 创建微信小程序云开发 TypeScript 项目。
2. 配置 `miniprogram/` 和 `cloudfunctions/`。
3. 完成 `user.bootstrap`。
4. 完成基础页面、主题和导航。

### 阶段二：数据闭环

1. 创建 `submissions` 集合和索引。
2. 完成新建、编辑、草稿、提交和历史详情。
3. 完成服务端校验和软删除。

### 阶段三：AI 评估

1. 创建 `evaluation_jobs` 和 `evaluations`。
2. 完成规则引擎和 Mock Provider。
3. 接入真实模型 Provider。
4. 完成任务重试、缓存和结果页。

### 阶段四：管理员

1. 创建 `admins` 和 `admin_audit_logs`。
2. 完成管理云函数。
3. 完成隐藏管理页。
4. 完成导出和内容处置。

### 阶段五：稳定性

1. 真机测试。
2. 内容安全。
3. 成本限制。
4. 日志、监控和备份。
5. 提交微信审核。

---

## 17. 最终建议

当前仓库已经初始化 Git，但还没有正式小程序代码。

建议下一步按以下顺序执行：

1. 安装并登录微信开发者工具。
2. 注册或确认微信小程序 AppID。
3. 先用官方云开发模板在一个临时目录验证云环境。
4. 再在当前仓库创建正式 TypeScript 小程序项目。
5. 建立 `miniprogram/`、`cloudfunctions/` 和首批数据库集合。
6. 先完成用户登录和提交 CRUD，不要一开始就接真实 AI。
7. AI 部分先用 Mock Provider，确保页面和任务状态稳定后再接真实模型。

---

## 18. 相关准备清单

账号、云环境、本地工具和 AI 开发约束的逐步准备清单见：

`docs/pre-development-and-ai-environment-checklist.md`
