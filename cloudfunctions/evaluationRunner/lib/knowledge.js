const CURATED_KNOWLEDGE_ENTRIES = [
  {
    id: 'card-core',
    types: ['CARD'],
    keywords: ['伤害', '攻击', '抽牌', '费用', '升级'],
    title: '卡牌基础实现',
    facts: [
      '卡牌通常由 CardModel 承载名称、费用、目标、稀有度和效果生命周期。',
      '动态数值应通过动态变量表达，升级变化不能只写在描述文本中。',
      '卡牌主体、卡池注册、本地化文本和卡面资源通常需要分别处理。',
    ],
    anchors: ['CardModel', 'DamageCmd', 'CardPool'],
    risks: ['数值来源、目标范围和升级差异不清时会增加返工。'],
    suggestions: ['补充费用、目标、升级前后数值和打出后的完整结算顺序。'],
  },
  {
    id: 'card-selection',
    types: ['CARD', 'RELIC', 'EVENT', 'BUFF'],
    keywords: ['选择手牌', '选择弃牌', '选择一张', '指定牌'],
    title: '选择界面',
    facts: [
      '需要额外选择界面，并处理取消、空牌堆、非法目标和结算中断。',
      '多人环境下还需要确认选择状态和敌人意图的同步方式。',
    ],
    anchors: ['CardModel'],
    risks: ['选择流程没有说明取消和空集合行为时，容易出现卡死或状态不同步。'],
    suggestions: ['明确候选范围、取消行为、无合法目标时的处理方式。'],
  },
  {
    id: 'multi-hit',
    types: ['CARD', 'RELIC', 'MONSTER', 'BOSS', 'BUFF'],
    keywords: ['每段', '多段', '重复', '再次造成', '连续攻击'],
    title: '多段结算',
    facts: [
      '多段效果需要明确每一段是否重新计算力量、易伤、格挡和其他修正。',
      '攻击动画、命中停顿和死亡中断都可能影响最终结算次数。',
    ],
    anchors: ['DamageCmd'],
    risks: ['未说明中断和加成规则时，测试结果容易与设计预期不一致。'],
    suggestions: ['补充每一段的数值计算、死亡中断和动画节奏要求。'],
  },
  {
    id: 'relic-core',
    types: ['RELIC'],
    keywords: ['触发', '回合开始', '回合结束', '获得', '战斗开始'],
    title: '遗物生命周期',
    facts: [
      'RelicModel 负责遗物主体、稀有度和触发钩子，遗物池负责进入奖励流程。',
      '触发时点需要区分战斗开始、回合开始、打出卡牌、受伤和战斗结束。',
      '图标、描边、说明文本和获得来源通常需要分别配置。',
    ],
    anchors: ['RelicModel', 'RelicPool', 'RelicIcon'],
    risks: ['触发频率和次数限制未明确时，可能与既有遗物产生重复结算。'],
    suggestions: ['明确触发窗口、每回合次数上限和多人同步要求。'],
  },
  {
    id: 'relic-all-enemy-hp-loss',
    types: ['RELIC', 'BUFF', 'CARD'],
    keywords: ['所有敌人', '失去生命', '生命值', '每打出一张牌', '直接失去'],
    title: '所有敌人直接失去生命',
    facts: [
      '这类效果不是普通攻击伤害，应按不可格挡、不受力量等伤害修正影响的直接生命损失处理。',
      '现有命令可用 CreatureCmd.Damage 配合 DamageProps.nonCardHpLoss 对 HittableEnemies 批量结算。',
      '触发时机可复用遗物或 Power 的 AfterCardPlayed，不需要自定义一套新战斗系统。',
    ],
    anchors: ['RelicModel', 'PowerModel', 'DamageCmd', 'HittableEnemies'],
    risks: ['如果按普通可格挡伤害实现，会与“失去生命值”的设计语义不一致。'],
    suggestions: ['明确触发频率、目标范围和每次触发数值。'],
  },
  {
    id: 'content-pool-acquisition',
    types: ['CARD', 'RELIC'],
    keywords: ['角色卡池', '无色卡池', '遗物池', '商店', '奖励', '获得方式'],
    title: '卡牌与遗物获取池',
    facts: [
      '角色卡牌池会进入对应角色的常规卡牌奖励和商店角色卡位；无色卡池主要用于商店无色卡位及生成无色卡的效果。',
      '通用遗物池和角色专属遗物池会进入对应玩家创建新局时的遗物抓取池。',
      '普通、罕见、稀有遗物可进入随机奖励，商店稀有度遗物进入商店专用遗物槽。',
      '事件遗物池不会自动进入随机奖励或商店，必须有事件或先古之民逻辑实际发放。',
    ],
    anchors: ['CardPool', 'RelicPool', 'RelicFactory'],
    risks: ['只注册模型但不加入正确获取池时，内容可能只能通过控制台出现。'],
    suggestions: ['按目标角色和获取来源选择正确的卡池或遗物池。'],
  },
  {
    id: 'event-core',
    types: ['EVENT'],
    keywords: ['选项', '奖励', '惩罚', '章节', '事件'],
    title: '事件流程',
    facts: [
      'EventModel 通常承载事件页面、选项、条件判断和结果分支。',
      '按章节注册还需要处理出现权重、重复出现和事件池冲突。',
      '多页面事件需要分别准备文本、按钮、背景和结果反馈。',
    ],
    anchors: ['EventModel', 'ActEventPool', 'EventBackground'],
    risks: ['奖励和惩罚没有边界条件时，可能出现重复领取或无法退出。'],
    suggestions: ['列出每个选项的前置条件、结果和只能触发一次的规则。'],
  },
  {
    id: 'power-core',
    types: ['BUFF'],
    keywords: ['层数', '持续', '回合', '状态', '触发'],
    title: 'Buff 与 Power',
    facts: [
      'PowerModel 适合承载层数、持续回合、触发钩子和状态显示。',
      '需要明确叠加、刷新、递减、清除和回合结束时点的先后顺序。',
      '图标和描述必须与真实层数及效果保持一致。',
    ],
    anchors: ['PowerModel', 'StatusSync', 'PowerIcon'],
    risks: ['叠加和持续规则模糊时，容易出现无限增长或跨战斗残留。'],
    suggestions: ['补充叠加上下限、持续条件、移除时机和多人同步行为。'],
  },
  {
    id: 'monster-core',
    types: ['MONSTER', 'BOSS'],
    keywords: ['意图', '阶段', '召唤', '行为', '血量'],
    title: '怪物与 Boss 行为',
    facts: [
      'MonsterModel 管理属性、意图和移动状态机，遭遇池负责章节接入。',
      'Boss 多阶段通常需要额外状态、阶段切换条件和专属表现。',
      '意图、动画、受击反馈和死亡处理需要与行为状态同步。',
    ],
    anchors: ['MonsterModel', 'EncounterRegistry', 'BossEncounterPool'],
    risks: ['阶段切换和召唤数量未收敛时，容易产生回合卡死或数值失控。'],
    suggestions: ['补充行为循环、阶段阈值、召唤上限和失败保护。'],
  },
  {
    id: 'character-core',
    types: ['CHARACTER', 'ANCIENT'],
    keywords: ['资源', '卡池', '遗物池', '初始牌组', '对话'],
    title: '角色与先古之民集成',
    facts: [
      '角色通常需要卡池、遗物池、药水池、资源 UI、初始牌组和平衡配置。',
      '先古之民需要对话流程、遗物选项、章节随机池和场景资源。',
      '新增资源状态通常还要考虑存档、教程提示和多人模式。',
    ],
    anchors: ['CharacterModel', 'CardPool', 'AncientEventModel'],
    risks: ['池和 UI 没有一起纳入时，功能可能可运行但无法进入正常游戏流程。'],
    suggestions: ['按角色池、资源 UI、初始配置、对话和美术资源拆分工作项。'],
  },
  {
    id: 'asset-replacement',
    types: ['SKIN', 'VOICE'],
    keywords: ['贴图', '立绘', '动画', '语音', '音乐', '多语言'],
    title: '资源替换与兼容',
    facts: [
      '资源替换需要匹配目标对象的路径、尺寸、帧率、音频格式和触发映射。',
      '游戏更新可能改变资源结构，因此需要记录版本并准备回退。',
      '资源清单、版权来源和打包体积需要在实现前确认。',
    ],
    anchors: ['SpriteReplacement', 'AudioReplacement', 'VersionCompatibility'],
    risks: ['替换对象和资源规格不清时，工作量和兼容风险会被明显低估。'],
    suggestions: ['列出替换对象、资源数量、格式、尺寸和授权来源。'],
  },
  {
    id: 'multiplayer',
    types: ['CARD', 'RELIC', 'EVENT', 'CHARACTER', 'ANCIENT', 'MONSTER', 'BOSS', 'BUFF'],
    keywords: ['多人', '联机', '队友', '同步'],
    title: '多人兼容检查',
    facts: [
      '多人模式需要验证状态同步、随机数、选择确认和结算顺序。',
      '只在本机表现正常不代表联机状态下行为一致。',
    ],
    anchors: ['StatusSync', 'VersionCompatibility'],
    risks: ['同步职责不清可能导致状态漂移、重复触发或不同步结束回合。'],
    suggestions: ['定义服务端权威状态、客户端表现职责和冲突处理策略。'],
  },
  {
    id: 'localization-path',
    types: ['CARD', 'RELIC', 'EVENT', 'CHARACTER', 'ANCIENT', 'SKIN', 'MONSTER', 'BOSS', 'VOICE', 'BUFF'],
    keywords: ['本地化', '文本', '描述', '台词', '翻译', '多语言'],
    title: '本地化路径与文本键',
    facts: [
      '模组本地化必须放在 res://<modid>/localization/<language>/，例如 testmod1/localization/zhs/cards.json。',
      '卡牌、遗物、能力、事件、怪物等分别使用 cards、relics、powers、events、monsters 等文本表。',
      '使用 SelectionScreenPrompt 时必须有 <ID>.selectionScreenPrompt，否则出牌可能卡住。',
      '描述中的 DynamicVar 占位符必须在模型代码中定义同名变量。',
    ],
    anchors: ['CardModel', 'RelicModel', 'EventModel', 'PowerModel'],
    risks: ['本地化键或路径缺失会导致文本为空、按钮无字或选择阶段无法退出。'],
    suggestions: ['列出所有需要本地化的标题、描述、选项和选择提示。'],
  },
  {
    id: 'power-command',
    types: ['BUFF', 'CARD', 'RELIC', 'MONSTER', 'BOSS'],
    keywords: ['施加能力', '获得状态', 'buff', 'debuff', '中毒', '虚弱', '易伤', '层数'],
    title: 'PowerCmd 实际调用签名',
    facts: [
      'PowerCmd.Apply<T> 以 choiceContext 开头：PowerCmd.Apply<T>(choiceContext, target, amount, applier, cardSource)。',
      'PowerModel 需要定义 PowerType、PowerStackType、AllowNegative 和对应触发钩子。',
      '临时属性可使用 TemporaryDexterityPower 或 TemporaryStrengthPower。',
      '需要确认负数层数、叠加、移除和多人同步行为。',
    ],
    anchors: ['PowerCmd', 'PowerModel', 'TemporaryDexterityPower', 'TemporaryStrengthPower'],
    risks: ['把状态当作普通伤害处理会绕过层数、持续、移除和同步逻辑。'],
    suggestions: ['明确状态类型、叠加规则、持续时间、触发时机和移除条件。'],
  },
  {
    id: 'ancient-special-rules',
    types: ['ANCIENT', 'EVENT', 'RELIC'],
    keywords: ['先古之民', '遗物选项', '对话', 'AncientDialogue', '章节随机池'],
    title: '先古之民高优先级规则',
    facts: [
      '遗物选项必须通过 RelicOption<T>() 或 EventOption.FromRelic(...) 关联。',
      'new AncientDialogue() 会异常，单行对话写 new AncientDialogue("")。',
      '先古之民奖励遗物建议使用 RelicRarity.Ancient。',
      '章节接入通常需要 patch ActModel 的 AllAncients。',
    ],
    anchors: ['AncientEventModel', 'RelicOption', 'AncientDialogue', 'RelicRarity.Ancient'],
    risks: ['遗物关联、对话或章节池缺失时，事件可能可见但无法正常领取奖励。'],
    suggestions: ['明确所属章节、遗物选项、对话行数和随机池接入方式。'],
  },
  {
    id: 'registration-packaging',
    types: ['CARD', 'RELIC', 'EVENT', 'CHARACTER', 'ANCIENT', 'SKIN', 'MONSTER', 'BOSS', 'VOICE', 'BUFF'],
    keywords: ['注册', '卡池', '遗物池', '打包', '发布', 'dll', 'pck', 'manifest'],
    title: '注册与打包闭环',
    facts: [
      '模型通常由 ModelDb 反射注册，但必须加入对应池或章节池后才会出现在正常流程。',
      '修改 C# 后需要重新编译并同步 DLL，修改本地化、美术或场景后需要重新导出 pck。',
      'manifest、DLL 和 pck 必须使用同一模组 ID 并放在同一目录。',
      '引用核心模型时必须使用 MegaCrit.Sts2.Core.Models 命名空间。',
    ],
    anchors: ['ModHelper.AddModelToPool', 'ModelDb', 'ModelInitializer'],
    risks: ['遗漏池注册或 pck 会导致内容不出现、文本缺失或效果更新不生效。'],
    suggestions: ['把模型、池注册、本地化、资源、DLL 和 pck 列为独立验收项。'],
  },
  {
    id: 'x-cost-star',
    types: ['CARD'],
    keywords: ['x费用', 'x能量', '星费用', '星星', '计算伤害', '动态费用'],
    title: 'X 费用与星费用',
    facts: [
      'X 能量需要 HasEnergyCostX => true，并在 ResolveEnergyXValue() 中解析实际值。',
      '星费用使用 CanonicalStarCost，或 HasStarCostX 配合 ResolveStarXValue()。',
      '计算伤害可通过 CalculatedDamageVar(...).WithMultiplier(...) 动态计算。',
    ],
    anchors: ['CardModel', 'CalculatedDamageVar', 'ResolveEnergyXValue', 'ResolveStarXValue'],
    risks: ['X 费用的预览、实际消耗和多人同步规则不一致时容易产生错误数值。'],
    suggestions: ['补充 X 的取值来源、上限、预览数值和消耗顺序。'],
  },
  {
    id: 'potion-enchantment',
    types: ['CARD', 'RELIC', 'BUFF'],
    keywords: ['药水', '附魔', 'enchantment', '卡牌改造'],
    title: '药水与附魔',
    facts: [
      'PotionModel 需要定义 PotionRarity、PotionUsage、TargetType，并在 OnUse 中执行效果。',
      'EnchantmentModel 可通过 CardCmd.Enchant<T> 施加，并处理数值和额外卡牌文本。',
      '药水、附魔都要确认本地化、图标、池注册和与现有卡牌的交互。',
    ],
    anchors: ['PotionModel', 'PotionCmd', 'EnchantmentModel', 'CardCmd'],
    risks: ['附魔改写伤害、格挡或打出次数时，容易与短暂增益和多人结算冲突。'],
    suggestions: ['明确目标卡牌范围、叠加规则、数值修改顺序和移除条件。'],
  },
  {
    id: 'card-keyword-glossary',
    types: ['CARD', 'RELIC', 'EVENT', 'BUFF'],
    keywords: ['永恒', '消耗', '虚无', '固有', '保留', '奇巧', '不能被打出', '移除', '变化'],
    title: '卡牌关键词中英术语映射',
    facts: [
      '永恒对应 CardKeyword.Eternal，官方中文描述是“无法从你的牌组中移除或变化”。',
      '消耗对应 CardKeyword.Exhaust，含义是卡牌离开当前牌堆并进入消耗牌堆，在本场战斗结束前不能再次使用。',
      '虚无对应 CardKeyword.Ethereal。如果这张牌在回合结束时仍在手牌中，则将其消耗。',
      '固有对应 CardKeyword.Innate，战斗开始时进入起手手牌。',
      '保留对应 CardKeyword.Retain，牌不会在回合结束时被弃掉。',
      '奇巧对应 CardKeyword.Sly，如果回合结束前从手牌被丢弃，则免费打出。',
      '不能被打出对应 CardKeyword.Unplayable。',
      '给整副牌组获得永恒，通常需要维护 CardKeyword.Eternal，并检查卡组移除、变化以及后续加入卡牌的覆盖范围。',
    ],
    anchors: [
      'CardKeyword.Eternal',
      'CardKeyword.Exhaust',
      'CardKeyword.Ethereal',
      'CardKeyword.Innate',
      'CardKeyword.Retain',
      'CardKeyword.Sly',
      'CardKeyword.Unplayable',
    ],
    risks: [
      '整副牌组获得永久词条时，需要处理已有卡牌、新加入牌组、变化、多人同步和存档。',
      '如果遗物被移除，需要只撤销遗物授予的词条，不能影响卡牌原本就拥有的永恒。',
    ],
    suggestions: [
      '使用官方术语描述效果即可，内部实现由评估器根据现有系统选择最稳妥方案。',
    ],
  },
];

let SOURCE_KNOWLEDGE_ENTRIES = [];
try {
  const sourceCatalog = require('../knowledge/catalog.json');
  SOURCE_KNOWLEDGE_ENTRIES = Array.isArray(sourceCatalog.entries)
    ? sourceCatalog.entries
    : [];
} catch (error) {
  SOURCE_KNOWLEDGE_ENTRIES = [];
}

const KNOWLEDGE_ENTRIES = [
  ...CURATED_KNOWLEDGE_ENTRIES.map((entry) => ({
    ...entry,
    kind: 'CURATED',
    priority: entry.priority || 6,
  })),
  ...SOURCE_KNOWLEDGE_ENTRIES,
];

function retrieveKnowledge(submission, ruleResult, limit = 3) {
  const text = `${submission.name || ''}\n${submission.designText || ''}`;
  const anchors = new Set((ruleResult.technicalAnchors || []).map((item) => item.name));
  const scoredEntries = KNOWLEDGE_ENTRIES.map((entry) => {
    const acceptsType = !entry.types?.length || entry.types.includes(submission.type);
    const keywordScore = entry.keywords.reduce(
      (sum, keyword) => sum + (text.includes(keyword) ? 2 : 0),
      0,
    );
    const anchorScore = entry.anchors.reduce(
      (sum, anchor) => sum + (anchors.has(anchor) ? 1 : 0),
      0,
    );
    const requiresKeyword = [
      'CURATED',
      'COMMAND',
      'EXAMPLE',
      'ENUM',
      'MONSTER_MOVE',
      'CARD_KEYWORD',
      'GLOSSARY',
    ].includes(entry.kind);
    if (!acceptsType || (requiresKeyword && keywordScore + anchorScore === 0)) {
      return { entry, score: 0 };
    }
    let score = Number(entry.priority || 0);
    score += acceptsType && entry.types?.length ? 4 : 0;
    score += keywordScore;
    score += anchorScore;
    return { entry, score };
  });
  const uniqueEntries = [...scoredEntries.reduce((map, item) => {
    const current = map.get(item.entry.id);
    if (!current || item.score > current.score) map.set(item.entry.id, item);
    return map;
  }, new Map()).values()];
  const scored = uniqueEntries
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ entry }) => ({
      id: entry.id,
      title: entry.title,
      kind: entry.kind || 'CURATED',
      facts: (entry.facts || []).slice(0, 4),
      anchors: (entry.anchors || []).slice(0, 4),
      risks: (entry.risks || []).slice(0, 2),
      suggestions: (entry.suggestions || []).slice(0, 2),
      source: entry.source || '',
    }));

  if (!scored.length) {
    return [
      {
        id: 'general-check',
        title: '通用实现检查',
        kind: 'FALLBACK',
        facts: ['实现前需要确认模型、命令、注册池、资源、本地化和多版本兼容范围。'],
        anchors: [],
        risks: ['设计描述不足时无法确认具体接口和集成范围。'],
        suggestions: ['补充核心流程、触发时机、数值和资源要求。'],
        source: '',
      },
    ];
  }

  return scored;
}

module.exports = {
  CURATED_KNOWLEDGE_ENTRIES,
  KNOWLEDGE_ENTRIES,
  SOURCE_KNOWLEDGE_ENTRIES,
  retrieveKnowledge,
};
