const DIFFICULTY_LABELS = {
  SIMPLE: '简单',
  MEDIUM: '中等',
  HARD: '困难',
  EXTREME: '极难',
};

const TYPE_LABELS = {
  CARD: '卡牌',
  RELIC: '遗物',
  EVENT: '事件',
  CHARACTER: '角色',
  ANCIENT: '先古之民',
  SKIN: '替换皮肤',
  MONSTER: '怪物',
  BOSS: 'Boss',
  VOICE: '语音替换',
  BUFF: 'Buff',
};

const TYPE_DIMENSIONS = {
  CARD: { apiFit: 10, logicComplexity: 6, integrationScope: 3, visualAssets: 4, compatibility: 2, versionStability: 2 },
  RELIC: { apiFit: 9, logicComplexity: 5, integrationScope: 3, visualAssets: 4, compatibility: 2, versionStability: 2 },
  EVENT: { apiFit: 12, logicComplexity: 8, integrationScope: 7, visualAssets: 6, compatibility: 4, versionStability: 4 },
  CHARACTER: { apiFit: 18, logicComplexity: 15, integrationScope: 13, visualAssets: 14, compatibility: 9, versionStability: 7 },
  ANCIENT: { apiFit: 17, logicComplexity: 13, integrationScope: 12, visualAssets: 13, compatibility: 7, versionStability: 6 },
  SKIN: { apiFit: 11, logicComplexity: 7, integrationScope: 6, visualAssets: 14, compatibility: 11, versionStability: 7 },
  MONSTER: { apiFit: 13, logicComplexity: 12, integrationScope: 9, visualAssets: 10, compatibility: 7, versionStability: 5 },
  BOSS: { apiFit: 19, logicComplexity: 17, integrationScope: 14, visualAssets: 15, compatibility: 10, versionStability: 7 },
  VOICE: { apiFit: 6, logicComplexity: 4, integrationScope: 2, visualAssets: 12, compatibility: 8, versionStability: 5 },
  BUFF: { apiFit: 10, logicComplexity: 8, integrationScope: 4, visualAssets: 5, compatibility: 4, versionStability: 4 },
};

const TYPE_ANCHORS = {
  CARD: [
    { kind: 'MODEL', name: 'CardModel', usage: '卡牌主体、生命周期和升级信息', confidence: 0.96 },
    { kind: 'COMMAND', name: 'DamageCmd', usage: '执行伤害和攻击表现', confidence: 0.92 },
    { kind: 'POOL', name: 'CardPool', usage: '将卡牌接入角色卡池', confidence: 0.9 },
  ],
  RELIC: [
    { kind: 'MODEL', name: 'RelicModel', usage: '遗物主体、稀有度和触发钩子', confidence: 0.96 },
    { kind: 'POOL', name: 'RelicPool', usage: '将遗物接入奖励池', confidence: 0.91 },
    { kind: 'ASSET', name: 'RelicIcon', usage: '遗物图标和描边资源', confidence: 0.86 },
  ],
  EVENT: [
    { kind: 'MODEL', name: 'EventModel', usage: '事件页面、选项和结果', confidence: 0.94 },
    { kind: 'SYSTEM', name: 'ActEventPool', usage: '按章节注册事件', confidence: 0.88 },
    { kind: 'ASSET', name: 'EventBackground', usage: '事件背景和界面资源', confidence: 0.82 },
  ],
  CHARACTER: [
    { kind: 'MODEL', name: 'CharacterModel', usage: '角色主体、资源、初始牌组和遗物', confidence: 0.94 },
    { kind: 'POOL', name: 'CardPool', usage: '角色卡池注册', confidence: 0.91 },
    { kind: 'UI', name: 'CharacterResourceUI', usage: '角色专属资源界面', confidence: 0.84 },
  ],
  ANCIENT: [
    { kind: 'MODEL', name: 'AncientEventModel', usage: '先古之民事对话和选项流程', confidence: 0.93 },
    { kind: 'POOL', name: 'AncientPool', usage: '章节随机池和遗物选项', confidence: 0.88 },
    { kind: 'ASSET', name: 'AncientScene', usage: '场景、立绘和对话资源', confidence: 0.82 },
  ],
  SKIN: [
    { kind: 'ASSET', name: 'SpriteReplacement', usage: '贴图、立绘或动画资源替换', confidence: 0.86 },
    { kind: 'SYSTEM', name: 'AssetBinding', usage: '资源路径绑定和加载', confidence: 0.8 },
    { kind: 'COMPAT', name: 'VersionCompatibility', usage: '游戏更新后的资源结构兼容', confidence: 0.78 },
  ],
  MONSTER: [
    { kind: 'MODEL', name: 'MonsterModel', usage: '怪物属性、意图和行为状态机', confidence: 0.94 },
    { kind: 'SYSTEM', name: 'EncounterRegistry', usage: '遭遇池和章节接入', confidence: 0.88 },
    { kind: 'ASSET', name: 'MonsterAnimation', usage: '移动、受击和攻击动画', confidence: 0.83 },
  ],
  BOSS: [
    { kind: 'MODEL', name: 'MonsterModel', usage: 'Boss 主体和多阶段行为', confidence: 0.94 },
    { kind: 'SYSTEM', name: 'BossEncounterPool', usage: 'Boss 遭遇池和章节配置', confidence: 0.89 },
    { kind: 'ASSET', name: 'BossSceneAudio', usage: '场景、动画和专属音乐', confidence: 0.85 },
  ],
  VOICE: [
    { kind: 'ASSET', name: 'AudioReplacement', usage: '语音资源替换和打包', confidence: 0.88 },
    { kind: 'SYSTEM', name: 'VoiceTriggerMap', usage: '台词触发映射', confidence: 0.82 },
    { kind: 'COMPAT', name: 'LocalizationPackage', usage: '语言版本与游戏更新兼容', confidence: 0.78 },
  ],
  BUFF: [
    { kind: 'MODEL', name: 'PowerModel', usage: 'Buff 叠加、持续和触发钩子', confidence: 0.95 },
    { kind: 'SYSTEM', name: 'StatusSync', usage: '状态显示和多人同步', confidence: 0.82 },
    { kind: 'ASSET', name: 'PowerIcon', usage: '状态图标与描述文本', confidence: 0.86 },
  ],
};

const TYPE_REQUIRED_EXTRA = {
  CARD: [
    ['cost', '卡牌费用'],
    ['cardType', '卡牌类型'],
    ['targetType', '目标类型'],
    ['upgrade', '升级变化'],
  ],
  RELIC: [
    ['rarity', '遗物稀有度'],
    ['trigger', '触发时机'],
  ],
  EVENT: [
    ['chapter', '出现章节'],
    ['optionCount', '选项数量'],
    ['reward', '奖励或惩罚'],
  ],
  CHARACTER: [
    ['resource', '核心资源'],
    ['startingDeck', '初始牌组'],
    ['startingRelic', '起始遗物'],
    ['keywords', '机制关键词'],
  ],
  ANCIENT: [
    ['chapter', '所属章节'],
    ['relicCount', '遗物选项数量'],
    ['dialogueScale', '对话规模'],
  ],
  SKIN: [
    ['target', '替换对象'],
    ['assetScale', '资源规模'],
    ['animation', '动画改动范围'],
  ],
  MONSTER: [
    ['chapter', '出现章节'],
    ['behavior', '行为模式'],
    ['intentCount', '意图数量'],
  ],
  BOSS: [
    ['chapter', '所属章节'],
    ['phases', '阶段数'],
    ['encounter', '遭遇配置'],
  ],
  VOICE: [
    ['character', '替换角色'],
    ['lines', '台词数量'],
    ['triggerScope', '触发范围'],
  ],
  BUFF: [
    ['polarity', '增益或减益'],
    ['stackType', '叠加方式'],
    ['duration', '持续时间'],
    ['trigger', '触发时机'],
  ],
};

const KEYWORD_RULES = [
  {
    pattern: /永恒/,
    dimensions: { integrationScope: 3, compatibility: 2, versionStability: 1 },
    reason: '“永恒”对应 CardKeyword.Eternal，效果是卡牌无法从牌组中移除或变化。',
    risk:
      '整副牌组获得永恒时，需要处理已有卡牌、后续加入牌组的新卡牌，以及遗物移除或读档后的状态回滚。',
  },
  {
    pattern: /消耗(?:一张|所有|牌|手牌|抽牌堆|弃牌堆|牌堆)|被消耗|消耗过/,
    dimensions: { logicComplexity: 2, compatibility: 1 },
    reason: '“消耗”对应 CardKeyword.Exhaust，卡牌进入消耗牌堆并在战斗结束前不可再次使用。',
  },
  {
    pattern: /虚无|回合结束时.*手牌|手牌.*回合结束/,
    dimensions: { logicComplexity: 2 },
    reason: '“虚无”对应 CardKeyword.Ethereal，回合结束时若仍在手牌中则会消耗。',
  },
  {
    pattern: /固有|起手|开局.*手牌/,
    dimensions: { logicComplexity: 1 },
    reason: '“固有”对应 CardKeyword.Innate，战斗开始时进入起手手牌。',
  },
  {
    pattern: /保留|回合结束时.*不被弃掉/,
    dimensions: { logicComplexity: 1 },
    reason: '“保留”对应 CardKeyword.Retain，卡牌不会在回合结束时被弃掉。',
  },
  {
    pattern: /每段|多段|重复|再次造成|连续攻击/,
    dimensions: { logicComplexity: 4, compatibility: 2 },
    reason: '多段结算需要明确命令循环、动画节奏和伤害加成顺序。',
  },
  {
    pattern: /随机目标|随机敌人|随机选择/,
    dimensions: { logicComplexity: 3, compatibility: 2 },
    risk: '随机目标会影响表现、同步和可复现测试。',
  },
  {
    pattern: /选择手牌|选择弃牌|选择一张|指定牌/,
    dimensions: { logicComplexity: 4, visualAssets: 3 },
    reason: '需要额外选择界面，并处理取消、空牌堆和多人回滚。',
  },
  {
    pattern: /新资源|专属能量|资源条|独特机制/,
    dimensions: { integrationScope: 6, visualAssets: 4, compatibility: 3 },
    reason: '新增角色资源通常涉及 UI、存档、数值和多个池系统。',
  },
  {
    pattern: /跨章节|整局|永久|存档/,
    dimensions: { integrationScope: 4, compatibility: 4 },
    risk: '持久状态需要处理存档、版本迁移和重复触发。',
  },
  {
    pattern: /多人|联机|队友|同步/,
    dimensions: { compatibility: 7, versionStability: 3 },
    reason: '多人兼容需要额外验证状态同步和结算顺序。',
  },
  {
    pattern: /自动识别|动态生成|任意|任意条件/,
    dimensions: { versionStability: 5, logicComplexity: 3 },
    risk: '描述存在高不确定关键词，接口范围和边界条件尚未收敛。',
  },
  {
    pattern: /动画|立绘|模型|场景|音乐|语音|多语言/,
    dimensions: { visualAssets: 4, versionStability: 2 },
    reason: '美术、动画或音频资源会显著增加制作和打包工作量。',
  },
  {
    pattern: /阶段|二阶段|变换形态|召唤/,
    dimensions: { logicComplexity: 5, integrationScope: 3 },
    reason: '阶段变化或召唤通常需要更复杂的状态机和遭遇控制。',
  },
];

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function difficultyFromScore(score) {
  if (score <= 24) return 'SIMPLE';
  if (score <= 49) return 'MEDIUM';
  if (score <= 74) return 'HARD';
  return 'EXTREME';
}

function buildImplementationBrief(type) {
  return (
    {
      CARD:
        '以卡牌自身的效果生命周期为主，打出的行为复用现有战斗命令，数值和升级通过动态变量统一管理，特殊时机放到对应战斗钩子。',
      RELIC:
        '以遗物的获得、战斗和回合触发为主。全局卡组效果优先在统一状态计算或卡组变更入口处理，避免逐张卡牌重复写入。',
      EVENT:
        '通过事件页面、选项和结果分支实现，奖励与惩罚调用现有卡牌、遗物、金币和战斗流程。',
      CHARACTER:
        '需要把角色、初始牌组、遗物和资源界面接入现有角色与池系统，再通过统一状态层处理专属资源。',
      ANCIENT:
        '通过先古之民事件流程和遗物选项实现，并接入对应章节的随机出现池。',
      SKIN:
        '按目标对象替换贴图、立绘、动画或场景资源，并通过资源覆盖或绑定层加载替换后的内容。',
      MONSTER:
        '通过怪物模型、意图状态机和遭遇注册实现，行为循环由状态机驱动。',
      BOSS:
        '通过 Boss 遭遇、行为状态机和阶段切换实现，必要时补充场景、音乐和专属表现。',
      VOICE:
        '通过音频资源替换和触发映射实现，保持原触发点，只替换对应语言的音频资源。',
      BUFF:
        '通过状态模型和触发钩子实现，统一管理层数、持续时间、移除时机和界面显示。',
    }[type] || '优先复用现有模型、命令和状态系统，把变化集中到统一入口后由界面读取结果。'
  );
}

function analyze(submission) {
  const type = submission.type;
  const base = { ...(TYPE_DIMENSIONS[type] || TYPE_DIMENSIONS.CARD) };
  const text = `${submission.name || ''}\n${submission.designText || ''}`;
  const reasons = [];
  const risks = [];
  const suggestions = [];

  for (const rule of KEYWORD_RULES) {
    if (!rule.pattern.test(text)) continue;
    for (const [key, value] of Object.entries(rule.dimensions || {})) {
      base[key] = clamp((base[key] || 0) + value, 0, key === 'apiFit' ? 25 : key === 'logicComplexity' ? 20 : key === 'integrationScope' || key === 'visualAssets' || key === 'compatibility' ? 15 : 10);
    }
    if (rule.reason) reasons.push(rule.reason);
    if (rule.risk) risks.push(rule.risk);
  }

  const extra = submission.extra || {};
  const required = TYPE_REQUIRED_EXTRA[type] || [];
  const missingInformation = required
    .filter(([key]) => {
      const value = extra[key];
      return value === undefined || value === null || String(value).trim() === '';
    })
    .map(([, label]) => label);

  if (missingInformation.length) {
    base.versionStability = clamp(base.versionStability + Math.min(4, missingInformation.length), 0, 10);
    suggestions.push(`补充${missingInformation.slice(0, 3).join('、')}，可明显提高评估可信度。`);
  }

  const textLength = String(submission.designText || '').length;
  if (textLength < 80) {
    base.versionStability = clamp(base.versionStability + 3, 0, 10);
    risks.push('设计描述较短，触发条件、数值或边界行为可能尚未说明。');
    suggestions.push('补充战斗流程、触发顺序、数值变化和失败条件。');
  }

  const score = clamp(
    Object.values(base).reduce((sum, value) => sum + Number(value || 0), 0),
    0,
    100,
  );
  const difficulty = difficultyFromScore(score);
  const filledRatio = required.length
    ? (required.length - missingInformation.length) / required.length
    : 1;
  const confidence = clamp(
    0.42 + Math.min(textLength / 1200, 0.24) + filledRatio * 0.18 - Math.max(0, missingInformation.length - 2) * 0.04,
    0.35,
    0.88,
  );

  reasons.unshift(
    `${TYPE_LABELS[type] || type}基线得分 ${Object.values(TYPE_DIMENSIONS[type] || {}).reduce((sum, value) => sum + value, 0)}，规则层重点检查接口、逻辑、资源与兼容范围。`,
  );
  if (textLength >= 120) {
    reasons.push('描述包含较完整的效果说明，可以据此识别主要实现路径。');
  }
  if (!risks.length) {
    risks.push('仍需在目标游戏版本中核对接口名称、多人行为和资源打包方式。');
  }
  if (!suggestions.length) {
    suggestions.push('进入实现前先用最小样例验证核心命令和注册流程。');
  }

  return {
    difficulty: {
      level: difficulty,
      label: DIFFICULTY_LABELS[difficulty],
      score,
      confidence: Number(confidence.toFixed(2)),
      provisional: confidence < 0.55,
    },
    summary: `${TYPE_LABELS[type] || type}设计预计为${DIFFICULTY_LABELS[difficulty]}。主要工作量来自${Object.entries(base)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([key]) => dimensionLabel(key))
      .join('和')}。`,
    reasons: reasons.slice(0, 6),
    risks: risks.slice(0, 5),
    suggestions: suggestions.slice(0, 5),
    missingInformation: missingInformation.slice(0, 8),
    technicalAnchors: TYPE_ANCHORS[type] || TYPE_ANCHORS.CARD,
    dimensions: base,
    implementationBrief: buildImplementationBrief(type),
  };
}

function dimensionLabel(key) {
  return (
    {
      apiFit: '接口改动量',
      logicComplexity: '逻辑复杂度',
      integrationScope: '系统集成范围',
      visualAssets: '资源制作量',
      compatibility: '兼容与同步风险',
      versionStability: '信息不确定度',
    }[key] || key
  );
}

module.exports = {
  DIFFICULTY_LABELS,
  TYPE_ANCHORS,
  analyze,
  difficultyFromScore,
};
