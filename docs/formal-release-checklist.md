# 正式版发布准备清单

本清单用于小程序备案完成后的正式版上传、审核和发布。仓库内可自动检查的项目先运行：

```powershell
npm run release:preflight
```

## 1. 云环境

1. 确认 `miniprogram/config/env.ts` 使用正式云环境 ID，不要继续使用开发环境。
2. 生产云函数统一设置 `APP_ENV=prod`：
   - `api`
   - `evaluationRunner`
   - `systemInit`
3. `systemInit` 必须配置高强度 `INIT_SECRET`，初始化完成后不要向普通用户开放调用入口。
4. `api` 和 `evaluationRunner` 的执行超时至少为 60 秒。
5. `api`、`evaluationRunner` 和 `sl2modc` 的 `MOD_BUILD_TOKEN` 必须完全一致。
6. AI Key 只放在 `evaluationRunner` 环境变量中，确认没有进入客户端、数据库、日志或 Git。

## 2. 数据库与云存储

1. 核心集合权限统一设置为仅云函数可读写。
2. 创建 `docs/cloud-development-setup.md` 中列出的索引。
3. 确认 `submissions`、`evaluations`、`evaluation_jobs` 和 `mod_generation_jobs` 可正常查询。
4. 确认 `admin-exports/` 不允许公开读取。
5. 为管理员导出文件设置生命周期清理策略。
6. 将管理员账号写入 `admins`，角色从 `SUPER_ADMIN` 开始。

## 3. AI 与 MOD 构建

1. 在 `evaluationRunner` 使用生产模型、生产 Key、限额和告警。
2. 用正式模型完成至少一次卡牌、遗物和 Buff 评估。
3. 确认评估结果包含 `modspec-v8`，旧版本结果会要求重新评估。
4. 用重新评估后的设计生成一次卡牌 MOD、遗物 MOD 和 Buff MOD。
5. 在游戏中验证卡牌升级前后数值、卡牌角色池、遗物奖励或商店来源。
6. 确认 CloudBase Run `sl2modc` 已部署最新代码，健康检查返回正常。

## 4. 小程序上传

1. 运行全部检查：

```powershell
npm run check:cloud
npm run check:miniprogram
npm run typecheck
npm test
npm run release:preflight
```

如果本地尚未安装 `typescript`，先执行 `npm install`。微信开发者工具的 TypeScript 编译不能替代仓库级类型检查。

2. 在微信开发者工具中确认 `project.config.json` 使用正式 AppID。
3. 确认没有使用开发环境云函数或测试数据库。
4. 真机检查首页、编辑、评估、详情、分享导入、管理页和 MOD 生成。
5. 上传体验版，使用非管理员微信账号完整走一遍用户流程。
6. 体验版确认后再上传正式审核版本。

## 5. 微信平台材料

1. 确认服务类目与实际功能一致。
2. 确认隐私保护指引包含：
   - 云开发用户标识
   - 用户提交的设计正文
   - 第三方 AI 处理说明
   - 用户删除数据的途径
3. 确认小程序简介不暗示与游戏官方存在授权或合作关系。
4. 确认备案、主体信息和 AppID 一致。
5. 准备审核说明，明确该工具用于设计归档和实现难度评估，不提供盗版、破解或付费绕过能力。

## 6. 发布后

1. 每天检查云函数错误日志和模型调用失败率。
2. 检查 AI 消费额度和异常高频用户。
3. 检查 MOD 构建失败日志和 CloudBase Run 资源用量。
4. 保留上一版小程序的代码和云函数配置，准备快速回滚。
5. 游戏版本更新后重新构建知识库，并标记需要重新评估的历史设计。

## 7. 当前仍需人工确认

- 微信公众平台的正式版审核结果。
- 云数据库权限、索引和备份。
- 生产 AI 模型的服务条款、数据处理方式和费用上限。
- 正式主体客服或问题反馈渠道。
- 账号级数据注销策略和人工处理流程。
