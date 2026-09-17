const CARD_RARITY_MAP = {
  基础: 'Basic',
  普通: 'Common',
  罕见: 'Uncommon',
  稀有: 'Rare',
  先古: 'Ancient',
  事件: 'Event',
  衍生: 'Token',
};

const RELIC_RARITY_MAP = {
  初始: 'Starter',
  普通: 'Common',
  罕见: 'Uncommon',
  稀有: 'Rare',
  商店: 'Shop',
  事件: 'Event',
  先古: 'Ancient',
};

const POWER_CLASS_MAP = {
  虚弱: 'WeakPower',
  易伤: 'VulnerablePower',
  脆弱: 'FrailPower',
  力量: 'StrengthPower',
  敏捷: 'DexterityPower',
  中毒: 'PoisonPower',
  荆棘: 'ThornsPower',
  活力: 'VigorPower',
};

const KEYWORD_MAP = [
  [/消耗/, 'EXHAUST'],
  [/虚无/, 'ETHEREAL'],
  [/固有|起手/, 'INNATE'],
  [/不可打出|无法打出/, 'UNPLAYABLE'],
  [/保留/, 'RETAIN'],
  [/奇巧/, 'SLY'],
  [/永恒/, 'ETERNAL'],
];

const MOD_SPEC_VERSION = 'modspec-v3';

function textOf(submission) {
  return `${submission.name || ''}\n${submission.designText || ''}`;
}

function extractNumber(text, pattern, fallback, maximum = 999) {
  const match = text.match(pattern);
  if (!match) return fallback;
  const value = Number(match[1]);
  if (!Number.isFinite(value) || value < 1) return fallback;
  return Math.min(maximum, Math.floor(value));
}

function detectKeywords(text) {
  return KEYWORD_MAP.filter(([pattern]) => pattern.test(text)).map(([, value]) => value);
}

function detectPower(text) {
  for (const [label, power] of Object.entries(POWER_CLASS_MAP)) {
    if (!text.includes(label)) continue;
    const amount = extractNumber(
      text,
      new RegExp(`${label}\\s*(\\d+)\\s*(?:层|点)?`),
      1,
      20,
    );
    return { power, amount };
  }
  return null;
}

function normalizeCardType(value, text) {
  const source = String(value || '');
  if (/攻击/.test(source) || /造成.*伤害/.test(text)) return 'Attack';
  if (/能力/.test(source) || /每回合|持续.*层/.test(text)) return 'Power';
  return 'Skill';
}

function makeModId(contentId) {
  return `sl2t_${String(contentId).toLowerCase()}`.slice(0, 48);
}

function userTag(submission) {
  return String(submission.ownerTag || 'LOCAL')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8) || 'LOCAL';
}

function contentId(submission, prefix) {
  const source = String(submission._id || 'ID').toUpperCase().replace(/[^A-Z0-9_]/g, '');
  return `${prefix}_${userTag(submission)}_${source}`.slice(0, 64);
}

function baseSpec(submission) {
  const tag = userTag(submission);
  const shortId = String(submission._id || 'idea')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(-8);
  return {
    schemaVersion: 1,
    mod: {
      id: makeModId(`${tag}_${shortId}`),
      name: `用户${tag}·${submission.name || '未命名设计'}`,
      author: 'SL2Together',
      description: `根据用户${tag}的设计「${submission.name || '未命名设计'}」自动生成。`,
      version: '1.0.0',
    },
  };
}

function unsupported(reason) {
  return {
    version: MOD_SPEC_VERSION,
    supported: false,
    reason,
    spec: null,
  };
}

function buildCardSpec(submission) {
  const text = textOf(submission);
  const extra = submission.extra || {};
  const effects = [];
  const discardAndDraw = /弃掉|丢弃|弃置/.test(text) && /抽/.test(text);
  const damage = /造成|攻击/.test(text)
    ? {
        type: 'DAMAGE',
        amount: extractNumber(text, /造成\s*(\d+)\s*点?伤害/, 6, 99),
        target: /所有敌人|全体敌人/.test(text) ? 'ALL_ENEMIES' : 'CARD_TARGET',
      }
    : null;
  if (damage) effects.push(damage);

  if (/获得.*格挡|提供.*格挡|给予.*格挡/.test(text)) {
    effects.push({
      type: 'GAIN_BLOCK',
      amount: extractNumber(text, /获得\s*(\d+)\s*点?格挡/, 5, 99),
    });
  }
  if (/抽(?:牌|\s*\d+\s*张)/.test(text) && !discardAndDraw) {
    effects.push({
      type: 'DRAW',
      amount: extractNumber(text, /抽\s*(\d+)\s*张/, 1, 10),
    });
  }
  if (/获得.*能量/.test(text)) {
    effects.push({
      type: 'GAIN_ENERGY',
      amount: extractNumber(text, /获得\s*(\d+)\s*点?能量/, 1, 10),
    });
  }
  if (/回复.*生命|治疗/.test(text)) {
    effects.push({
      type: 'HEAL',
      amount: extractNumber(text, /(?:回复|治疗)\s*(\d+)\s*点?生命/, 5, 99),
    });
  }

  if (discardAndDraw) {
    effects.push({
      type: 'DISCARD_AND_DRAW',
      discardCount: extractNumber(text, /(?:弃掉|丢弃|弃置)\s*(\d+)\s*张/, 1, 5),
      drawCount: extractNumber(text, /抽\s*(\d+)\s*张/, 1, 5),
      filter: /攻击牌/.test(text)
        ? 'ATTACK'
        : /技能牌/.test(text)
          ? 'SKILL'
          : /能力牌/.test(text)
            ? 'POWER'
            : 'ANY',
    });
  } else if (/弃掉|丢弃|弃置/.test(text)) {
    effects.push({
      type: 'DISCARD_CARDS',
      count: extractNumber(text, /(?:弃掉|丢弃|弃置)\s*(\d+)\s*张/, 1, 5),
      filter: /攻击牌/.test(text)
        ? 'ATTACK'
        : /技能牌/.test(text)
          ? 'SKILL'
          : /能力牌/.test(text)
            ? 'POWER'
            : 'ANY',
    });
  }

  if (/选择.*消耗|消耗一张|消耗\s*\d+\s*张/.test(text)) {
    effects.push({
      type: 'EXHAUST_CARDS',
      source: /抽牌堆.*消耗|消耗.*抽牌堆/.test(text) ? 'DRAW' : 'HAND',
      count: extractNumber(text, /消耗\s*(\d+)\s*张/, 1, 5),
      filter: /攻击牌/.test(text)
        ? 'ATTACK'
        : /技能牌/.test(text)
          ? 'SKILL'
          : /能力牌/.test(text)
            ? 'POWER'
            : 'ANY',
    });
  }

  if (/放回.*抽牌堆顶|置于抽牌堆顶|放到抽牌堆顶|回到抽牌堆顶/.test(text)) {
    effects.push({
      type: 'PUT_BACK_CARDS',
      count: extractNumber(text, /(\d+)\s*张/, 1, 3),
      filter: /攻击牌/.test(text)
        ? 'ATTACK'
        : /技能牌/.test(text)
          ? 'SKILL'
          : /能力牌/.test(text)
            ? 'POWER'
            : 'ANY',
    });
  }

  if (/检索|搜寻|搜索|查找/.test(text)) {
    const source = /消耗(?:牌堆|堆)/.test(text)
      ? 'EXHAUST'
      : /弃牌堆/.test(text)
        ? 'DISCARD'
        : 'DRAW';
    const filter = /攻击牌/.test(text)
      ? 'ATTACK'
      : /技能牌/.test(text)
        ? 'SKILL'
        : /能力牌/.test(text)
          ? 'POWER'
          : 'ANY';
    effects.push({
      type: 'SEARCH_CARD',
      source,
      destination: /牌堆顶/.test(text) ? 'DRAW_TOP' : 'HAND',
      filter,
      count: extractNumber(text, /(\d+)\s*张/, 1, 3),
    });
  }

  const power = detectPower(text);
  if (power) {
    effects.push({
      type: 'APPLY_POWER',
      power: power.power,
      amount: power.amount,
      target: /敌方|敌人|目标/.test(text) ? 'CARD_TARGET' : 'OWNER',
    });
  }

  const behaviors = /(?:被|进入).{0,6}消耗(?:牌堆|堆)?(?:后|的?时).{0,12}(?:自动)?打出|消耗堆.{0,12}自动打出/.test(text)
    ? [{ type: 'AUTO_PLAY_FROM_EXHAUST' }]
    : [];

  if (!effects.length && !behaviors.length) {
    return unsupported('卡牌描述未包含白名单内的伤害、格挡、抽牌、能量、治疗、状态或消耗堆自动打出效果。');
  }
  if (effects.filter((effect) => effect.type === 'DAMAGE').length > 1) {
    return unsupported('暂不支持多段伤害自动生成。');
  }

  const spec = baseSpec(submission);
  spec.content = {
    kind: 'CARD',
    id: contentId(submission, 'CARD'),
    name: submission.name || '未命名卡牌',
    description: submission.designText,
    card: {
      cost: Math.max(0, Math.min(9, Number(extra.cost) || (damage ? 1 : 0))),
      type: normalizeCardType(extra.cardType, text),
      target:
        damage && /所有敌人|全体敌人/.test(text)
          ? 'AllEnemies'
          : damage
            ? 'AnyEnemy'
            : 'Self',
      rarity: CARD_RARITY_MAP[String(extra.rarity || '')] || 'Common',
      pool: 'ColorlessCardPool',
      keywords: detectKeywords(text),
      effects,
      behaviors,
    },
  };
  return { version: MOD_SPEC_VERSION, supported: true, reason: '', spec };
}

function relicTrigger(text, extraTrigger) {
  const source = `${text}\n${extraTrigger || ''}`;
  if (/获得(?:时|后)|拾取/.test(source)) return 'AFTER_OBTAINED';
  if (/战斗开始|进入战斗/.test(source)) return 'BEFORE_COMBAT_START';
  if (/打出(?:一张)?牌后|使用卡牌后/.test(source)) return 'AFTER_CARD_PLAYED';
  if (/回合结束/.test(source)) return 'AFTER_TURN_END';
  return '';
}

function buildRelicSpec(submission) {
  const text = textOf(submission);
  const extra = submission.extra || {};
  const trigger = relicTrigger(text, extra.trigger);
  if (!trigger) {
    return unsupported('遗物触发时机不在白名单内，只支持获得时、战斗开始、打出卡牌后和回合结束。');
  }

  const effects = [];
  if (/格挡/.test(text)) {
    effects.push({
      type: 'GAIN_BLOCK',
      amount: extractNumber(text, /(\d+)\s*点?格挡/, 5, 99),
    });
  }
  if (/抽(?:牌|\s*\d+\s*张)/.test(text)) {
    effects.push({
      type: 'DRAW',
      amount: extractNumber(text, /抽\s*(\d+)\s*张/, 1, 10),
    });
  }
  if (/能量/.test(text)) {
    effects.push({
      type: 'GAIN_ENERGY',
      amount: extractNumber(text, /(\d+)\s*点?能量/, 1, 10),
    });
  }
  if (/回复.*生命|治疗/.test(text)) {
    effects.push({
      type: 'HEAL',
      amount: extractNumber(text, /(?:回复|治疗)\s*(\d+)\s*点?生命/, 5, 99),
    });
  }
  const power = detectPower(text);
  if (power) {
    effects.push({
      type: 'APPLY_POWER',
      power: power.power,
      amount: power.amount,
      target: 'OWNER',
    });
  }
  if (!effects.length) {
    return unsupported('遗物效果未包含白名单内的格挡、抽牌、能量、治疗或已知状态。');
  }
  if (trigger === 'BEFORE_COMBAT_START' && effects.some((effect) => effect.type !== 'GAIN_BLOCK')) {
    return unsupported('战斗开始的遗物第一版只支持获得格挡。');
  }

  const spec = baseSpec(submission);
  spec.content = {
    kind: 'RELIC',
    id: contentId(submission, 'RELIC'),
    name: submission.name || '未命名遗物',
    description: submission.designText,
    relic: {
      rarity: RELIC_RARITY_MAP[String(extra.rarity || '')] || 'Common',
      pool: 'EventRelicPool',
      triggers: [{ type: trigger, effects }],
    },
  };
  return { version: MOD_SPEC_VERSION, supported: true, reason: '', spec };
}

function powerTrigger(text, extraTrigger) {
  const source = `${text}\n${extraTrigger || ''}`;
  if (/打出(?:一张)?牌后|使用卡牌后|每次.*打出/.test(source)) return 'AFTER_CARD_PLAYED';
  if (/回合结束/.test(source)) return 'AFTER_TURN_END';
  return '';
}

function buildPowerSpec(submission) {
  const text = textOf(submission);
  const extra = submission.extra || {};
  const trigger = powerTrigger(text, extra.trigger);
  if (!trigger) {
    return unsupported('Buff 触发时机不在白名单内，只支持打出卡牌后和回合结束。');
  }
  const effects = [];
  if (/格挡/.test(text)) effects.push({ type: 'GAIN_BLOCK' });
  if (/抽(?:牌|\s*\d+\s*张)/.test(text)) effects.push({ type: 'DRAW' });
  if (/能量/.test(text)) effects.push({ type: 'GAIN_ENERGY' });
  if (/回复.*生命|治疗/.test(text)) effects.push({ type: 'HEAL' });
  const power = detectPower(text);
  if (power) {
    effects.push({ type: 'APPLY_POWER', power: power.power, amount: power.amount, target: 'OWNER' });
  }
  if (!effects.length) {
    return unsupported('Buff 效果未包含白名单内的格挡、抽牌、能量、治疗或已知状态。');
  }

  const spec = baseSpec(submission);
  spec.content = {
    kind: 'POWER',
    id: contentId(submission, 'POWER'),
    name: submission.name || '未命名 Buff',
    description: submission.designText,
    power: {
      type: /减益|负面|Debuff/i.test(`${extra.polarity || ''}${text}`) ? 'Debuff' : 'Buff',
      stackType: /不可叠加|Single/i.test(`${extra.stackType || ''}${text}`) ? 'Single' : 'Counter',
      triggers: [{ type: trigger, effects }],
    },
  };
  return { version: MOD_SPEC_VERSION, supported: true, reason: '', spec };
}

function buildRuleModSpec(submission) {
  if (!submission || !['CARD', 'RELIC', 'BUFF'].includes(submission.type)) {
    return unsupported('只有卡牌、遗物和 Buff 支持自动生成 MOD。');
  }
  if (submission.type === 'CARD') return buildCardSpec(submission);
  if (submission.type === 'RELIC') return buildRelicSpec(submission);
  return buildPowerSpec(submission);
}

module.exports = {
  MOD_SPEC_VERSION,
  buildRuleModSpec,
};
