# AI 服务商与游戏知识库

## 1. 什么时候需要真实 API

以下功能不需要真实 API：

- 登录、草稿、编辑、提交
- 历史列表和详情
- 规则评估
- Mock 评估
- 页面调试和任务状态验证

需要真实 API 的情况是：希望模型根据更自然的设计描述补充风险、调整建议和技术依据。即使接入真实模型，也应该保留规则评估作为降级路径。

## 2. 便宜的 API 怎么选

价格和免费额度会变化，应以服务商控制台当期价格为准。优先选择支持 OpenAI 兼容 `/chat/completions` 的国内服务，接入成本最低。

建议比较顺序：

1. 阿里云百炼 Qwen 的低价 Flash 系列：适合先测试结构化输出，通常有较低阶梯价格和活动额度。
2. DeepSeek 官方聊天模型：中文技术描述理解稳定，价格通常低于高能力推理模型，适合作为默认评估模型。
3. 智谱 GLM Flash 系列、火山方舟 Doubao Lite 系列：作为备用 Provider，比较稳定性和单位成本。
4. 不使用来源不明的共享 Key 或转售接口。提交内容可能包含用户创意，正式环境应选择可确认数据处理方式的服务商。

配置示例：

```text
AI_PROVIDER=openai-compatible
AI_BASE_URL=https://api.deepseek.com/v1
AI_MODEL=服务商控制台当前的聊天模型名
AI_API_KEY=你的密钥
AI_TIMEOUT_MS=30000
AI_JSON_MODE=true
AI_MAX_COMPLETION_TOKENS=1200
AI_ENABLE_THINKING=false
```

切换到其他兼容服务时，只替换 `AI_BASE_URL`、`AI_MODEL` 和 `AI_API_KEY`，业务代码不需要改。

`api` 和 `evaluationRunner` 必须同时配置相同的 `AI_PROVIDER`、`AI_MODEL`、`CATALOG_VERSION` 和 `PROMPT_VERSION`。API Key 和 Base URL 只放在 `evaluationRunner`。

如果服务商不支持 OpenAI 的 `response_format: {"type":"json_object"}`，将 `AI_JSON_MODE` 改为 `false`。适配层仍会解析模型返回的 JSON，并经过固定 Schema 校验。

如果服务商只支持旧版输出长度参数，改用 `AI_MAX_TOKENS`，并清空 `AI_MAX_COMPLETION_TOKENS`。开启思考模式会增加耗时和输出 Token 消耗，当前结构化评估建议 `AI_ENABLE_THINKING=false`。

建议先用小模型评估 20 至 30 条测试设计，比较：

1. JSON 成功率
2. 技术依据是否正确
3. 风险和修改建议是否有用
4. 每次评估平均 token
5. 失败率和平均耗时

不要一开始使用高价推理模型。大多数结构化难度判断由规则层、知识检索和少量模型改写即可完成。

## 3. 简单知识库的结构

当前实现由两层组成：

```text
knowledge/sl2-source-index.json
```

这是从本地 `C:\Users\akaset\Desktop\sl2` 抽出的完整源码接口索引，当前包含约 1872 个类型，用于维护和继续筛选，不全部上传到运行时的模型 Prompt。

```text
cloudfunctions/evaluationRunner/knowledge/catalog.json
```

这是运行时核心目录，当前约 254 条，包含核心模型、命令、池、枚举、动态变量和代表性内容示例。

人工整理的跨类型规则位于：

```text
cloudfunctions/evaluationRunner/lib/knowledge.js
```

每个知识片段包含：

```js
{
  id: 'card-core',
  types: ['CARD'],
  keywords: ['伤害', '费用', '升级'],
  title: '卡牌基础实现',
  facts: ['已知事实'],
  anchors: ['CardModel', 'DamageCmd'],
  risks: ['常见风险'],
  suggestions: ['需要补充的信息']
}
```

中文术语表由官方 `localization/zhs` 自动生成，至少包含卡牌关键词、常用状态和操作说明。内部代码名与中文显示名会同时进入检索，例如：

```text
ETERNAL -> 永恒 -> CardKeyword.Eternal
EXHAUST -> 消耗 -> CardKeyword.Exhaust
ETHEREAL -> 虚无 -> CardKeyword.Ethereal
INNATE -> 固有 -> CardKeyword.Innate
RETAIN -> 保留 -> CardKeyword.Retain
```

这样用户用中文描述设计时，模型能直接得到官方含义，不再根据英文词自行猜测。

评估时的流程是：

```text
设计类型 + 描述关键词
        |
        v
按类型、关键词、规则技术依据打分
        |
        v
只取最相关的 5 个知识片段
        |
        v
规则预判 + 知识片段 + 用户设计 -> 小模型
```

这比把完整游戏源码或所有接口文档塞进 Prompt 更快、更省 token，也更不容易让模型忽略重点。

## 4. 后续如何扩充

优先补充高频类型：

1. `CardModel`、动态变量、伤害命令、卡池和升级。
2. `RelicModel`、触发钩子和遗物池。
3. `PowerModel`、叠加、持续和状态同步。
4. `MonsterModel`、意图状态机、遭遇和动画。
5. `EventModel`、选项、章节事件池和奖励。

每个知识片段只保存：

- 已确认的模型或命令名称
- 它负责什么
- 常见集成点
- 常见风险
- 需要用户补充的信息
- 知识来源或版本

不要把反编译游戏代码、完整商业源码或无权分发的资源放进知识库。知识库应保存自己整理的接口摘要、公开文档说明和原创检查清单。

## 5. 版本与缓存

知识库版本写入 `catalog_versions`，并使用：

```text
contentHash + catalogVersion + promptVersion + model
```

作为评估缓存键。知识库更新后提高 `CATALOG_VERSION`，旧评估仍可保留，但不会继续命中旧缓存。

重建源码索引：

```powershell
npm run knowledge:build
npm run knowledge:check
```

默认读取 `C:\Users\akaset\Desktop\sl2`，也可以在 PowerShell 中通过 `SL2_SOURCE_ROOT` 指定其他解包目录。

建议知识库版本命名：

```text
sts2-api-2026.09-r4
sts2-api-2026.10
```

没有确认游戏版本时，不要只改日期。应在知识库中标记未验证内容，并降低评估置信度。
