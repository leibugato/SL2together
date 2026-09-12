# 数据库结构

所有核心集合只允许云函数读写。记录归属统一使用云函数上下文中的 `_openid`。

## users

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_openid` | string | 微信用户唯一标识 |
| `nickname` | string | 预留昵称，当前为空 |
| `avatarUrl` | string | 预留头像，当前为空 |
| `status` | string | `active` |
| `createdAt` | date | 创建时间 |
| `updatedAt` | date | 更新时间 |
| `lastActiveAt` | date | 最近活跃时间 |

## submissions

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_openid` | string | 所属用户 |
| `type` | string | 十类内容枚举 |
| `name` | string | 1 至 60 字符 |
| `designText` | string | 20 至 5000 字符 |
| `resourceUrl` | string | 可选 HTTP(S) 链接 |
| `extra` | object | 按类型保存的补充字段 |
| `status` | string | 设计生命周期：`DRAFT`、`SUBMITTED`、`DELETED` |
| `evaluationStatus` | string | 评估状态：`NOT_EVALUATED`、`QUEUED`、`RUNNING`、`RETRYING`、`SUCCEEDED`、`FAILED` |
| `contentVersion` | number | 内容版本，实质性修改后加一 |
| `contentHash` | string | 规范化内容哈希 |
| `latestEvaluationId` | string/null | 最近评估 ID |
| `latestEvaluation` | object/null | 列表使用的评估摘要 |
| `createdAt` | date | 创建时间 |
| `updatedAt` | date | 更新时间 |
| `submittedAt` | date/null | 首次提交时间 |
| `deletedAt` | date/null | 软删除时间 |

评估不改变设计是否已提交。草稿可以反复评估，设计内容修改后旧评估会根据 `contentHash` 自动判定为过期。

### 旧数据迁移

如果早期测试数据中的 `status` 为 `EVALUATING`、`EVALUATED` 或 `EVALUATION_FAILED`：

1. 将 `status` 改为 `DRAFT` 或 `SUBMITTED`。
2. 将原状态映射为新 `evaluationStatus`：
   `EVALUATING -> RUNNING`、`EVALUATED -> SUCCEEDED`、`EVALUATION_FAILED -> FAILED`。
3. 新记录由云函数自动写入 `evaluationStatus`。

## evaluations

评估结果只追加，不覆盖历史。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_openid` | string | 所属用户 |
| `submissionId` | string | 提交 ID |
| `contentVersion` | number | 评估时内容版本 |
| `contentHash` | string | 评估时内容哈希 |
| `difficulty` | object | 难度、分数、置信度和暂定标志 |
| `summary` | string | 面向用户的摘要 |
| `implementationBrief` | string | 通俗说明评估器推测的主要实现方式，不要求用户选择代码实现 |
| `reasons` | string[] | 主要原因 |
| `risks` | string[] | 主要风险 |
| `suggestions` | string[] | 调整建议 |
| `missingInformation` | string[] | 缺失信息 |
| `technicalAnchors` | object[] | 模型、命令、池和资源依据 |
| `dimensions` | object | 六项评分维度 |
| `model` | object | Provider、模型、Prompt 和知识库版本 |
| `createdAt` | date | 创建时间 |

## evaluation_jobs

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_openid` | string | 所属用户 |
| `submissionId` | string | 提交 ID |
| `contentVersion` | number | 任务内容版本 |
| `contentHash` | string | 任务内容哈希 |
| `status` | string | `QUEUED`、`RUNNING`、`RETRYING`、`SUCCEEDED`、`FAILED` |
| `mode` | string | `quick` 或 `deep` |
| `attempts` | number | 已尝试次数 |
| `maxAttempts` | number | 最大尝试次数 |
| `provider` | string | AI Provider |
| `model` | string | 模型名称 |
| `catalogVersion` | string | 知识库版本 |
| `promptVersion` | string | Prompt 版本 |
| `evaluationId` | string | 成功后写入 |
| `lockedAt` | date/null | 执行锁时间 |
| `errorCode` | string/null | 错误码 |
| `errorMessage` | string/null | 脱敏错误信息 |

## usage_daily

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `_openid` | string | 用户 |
| `date` | string | `YYYY-MM-DD` |
| `evaluationCount` | number | 当日评估次数 |

## catalog_versions

记录每次评估使用的游戏接口知识库版本。缓存键包含：

```text
contentHash + catalogVersion + promptVersion + model
```

## 后续管理员集合

`admins` 和 `admin_audit_logs` 已接入 `adminApi` 和隐藏管理页。管理接口会在每次操作前重新查询 `admins` 集合，不能只依赖页面入口。

数据筛选与导出流程见 `docs/admin-data-export.md`。
