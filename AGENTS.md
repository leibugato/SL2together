# AI Development Rules

本项目是微信原生 TypeScript 小程序，使用微信云开发。

开始修改前必须阅读：

1. `docs/wechat-mod-design-platform-design.md`
2. `docs/technical-architecture-and-development-guide.md`
3. `docs/cloud-development-setup.md`
4. 本文件和 `README.md`

硬性约束：

1. AI API Key 只能放在云函数环境变量中。
2. 小程序端不得直接写核心业务集合。
3. 所有数据写操作必须经过云函数并进行服务端校验。
4. 不信任客户端传入的 `_openid`、`status`、`role`、`latestEvaluationId`。
5. 十种内容类型、状态和难度枚举必须保持集中定义。
6. 数据库字段修改必须同步更新 `docs/database-schema.md` 和迁移说明。
7. AI 输出必须经过固定 Schema、枚举、范围和长度校验。
8. 新页面必须处理加载、空、失败和未配置云环境状态。
9. 修改后至少运行 `npm run check:cloud`、`npm run check:miniprogram` 和 `npm test`。
10. 更新游戏接口知识后运行 `npm run knowledge:build` 和 `npm run knowledge:check`。
