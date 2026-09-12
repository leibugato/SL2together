const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..');
const sourceRoot =
  process.env.SL2_SOURCE_ROOT || 'C:\\Users\\akaset\\Desktop\\sl2';

const SOURCE_DIRS = [
  'src\\Core\\Models',
  'src\\Core\\Models\\CardPools',
  'src\\Core\\Models\\RelicPools',
  'src\\Core\\Models\\PotionPools',
  'src\\Core\\Commands',
  'src\\Core\\Entities',
  'src\\Core\\Localization\\DynamicVars',
  'src\\Core\\MonsterMoves',
];

const GLOSSARY_SOURCES = [
  {
    file: 'localization\\zhs\\card_keywords.json',
    kind: 'CARD_KEYWORD',
    types: [],
    anchorPrefix: 'CardKeyword',
    priority: 10,
  },
  {
    file: 'localization\\zhs\\static_hover_tips.json',
    kind: 'GLOSSARY',
    types: [],
    anchorPrefix: 'StaticTip',
    priority: 5,
    includeKeys: new Set([
      'BLOCK',
      'DISCARD_PILE',
      'DRAW_PILE',
      'ENERGY',
      'ENERGY_COUNT',
      'EVOKE',
      'EXHAUST_PILE',
      'FORGE',
      'HIT_POINTS',
      'MONEY_POUCH',
      'POTION_SLOT',
      'REPLAY_DYNAMIC',
      'REPLAY_STATIC',
      'STAR_COUNT',
      'STUN',
      'SUMMON_DYNAMIC',
      'SUMMON_STATIC',
      'TRANSFORM',
    ]),
  },
];

const EXCLUDED_PATH_PARTS = [
  '\\Mocks\\',
  '\\Generated\\',
  '\\SourceGeneration\\',
  '\\RiderTestRunner\\',
  '\\System\\',
];

const BASE_MODEL_FILES = new Set([
  'AbstractModel.cs',
  'ActModel.cs',
  'AncientEventModel.cs',
  'CardModel.cs',
  'CardPoolModel.cs',
  'CharacterModel.cs',
  'EnchantmentModel.cs',
  'EncounterModel.cs',
  'EventModel.cs',
  'MonsterModel.cs',
  'PotionModel.cs',
  'PotionPoolModel.cs',
  'PowerModel.cs',
  'RelicModel.cs',
  'RelicPoolModel.cs',
]);

const EXAMPLE_NAMES_BY_DIR = {
  'Models\\Cards': [
    'Accuracy',
    'AllForOne',
    'Anger',
    'Apparition',
    'Armaments',
    'BladeDance',
    'Bloodletting',
    'BodySlam',
    'BouncingFlask',
  ],
  'Models\\Relics': [
    'BiiigHug',
    'BlackBlood',
    'BloodVial',
    'BoneFlute',
    'BronzeScales',
    'BookOfFiveRings',
  ],
  'Models\\Powers': [
    'BurstPower',
    'ConfusedPower',
    'ConstrictPower',
    'TemporaryDexterityPower',
    'TemporaryStrengthPower',
    'WeakPower',
    'VulnerablePower',
  ],
  'Models\\Events': [
    'BattlewornDummy',
    'ColorfulPhilosophers',
    'RelicTrader',
    'SlipperyBridge',
  ],
  'Models\\Monsters': ['Aeonglass', 'Chomper', 'Exoskeleton', 'Fabricator'],
  'Models\\Encounters': [
    'AeonglassBoss',
    'CeremonialBeastBoss',
    'KaiserCrabBoss',
    'KnowledgeDemonBoss',
  ],
  'Models\\Characters': ['Defect', 'Ironclad', 'Necrobinder', 'Regent', 'Silent'],
  'Models\\Potions': [
    'FairyInABottle',
    'FirePotion',
    'FlexPotion',
    'FocusPotion',
  ],
  'Models\\Enchantments': ['Adroit', 'Clone', 'Momentum', 'Nimble'],
};

const TYPE_KEYWORDS = {
  CARD: ['卡牌', '伤害', '攻击', '格挡', '抽牌', '弃牌', '费用', '升级', '消耗', '能力'],
  RELIC: ['遗物', '触发', '战斗开始', '回合开始', '回合结束', '获得', '商店'],
  EVENT: ['事件', '选项', '奖励', '惩罚', '章节', '对话'],
  CHARACTER: ['角色', '初始牌组', '起始遗物', '卡池', '遗物池', '药水池', '能量', '资源'],
  ANCIENT: ['先古之民', '先古', '对话', '遗物选项', '章节'],
  SKIN: ['皮肤', '贴图', '立绘', '动画', '场景', '资源替换'],
  MONSTER: ['怪物', '敌人', '意图', '行为', '生命', '召唤', '动画'],
  BOSS: ['boss', '阶段', '血量', '遭遇', '场景', '音乐'],
  VOICE: ['语音', '台词', '音频', '语言', '触发'],
  BUFF: ['buff', 'debuff', '状态', '层数', '叠加', '持续', '回合', '力量', '敏捷', '虚弱', '易伤', '中毒'],
};

const COMMAND_KEYWORDS = {
  CardCmd: ['打出', '升级', '消耗', '附魔', '词条'],
  CardPileCmd: ['抽牌', '牌堆', '洗牌', '生成牌'],
  CardSelectCmd: ['选择手牌', '选择弃牌', '选牌', '牌组选择'],
  CreatureCmd: ['格挡', '治疗', '生命', '最大生命', '眩晕', '伤害'],
  DamageCmd: ['伤害', '攻击', '多段', '随机目标'],
  ForgeCmd: ['锻造', '铸造'],
  OrbCmd: ['充能球', '能量球', '激发'],
  OstyCmd: ['奥斯提', '召唤'],
  PlayerCmd: ['能量', '金币', '星星', '结束回合', '任务'],
  PotionCmd: ['药水'],
  PowerCmd: ['buff', 'debuff', '状态', '层数', '叠加', '持续'],
  RelicCmd: ['遗物', '获得遗物', '移除遗物'],
  RewardsCmd: ['奖励', '掉落'],
  SfxCmd: ['音效'],
  TalkCmd: ['对话', '台词'],
  VfxCmd: ['特效', '动画'],
};

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...walk(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.cs')) {
      result.push(fullPath);
    }
  }
  return result;
}

function isExcluded(filePath) {
  const normalized = `\\${path.relative(sourceRoot, filePath).replace(/\//g, '\\')}`;
  return EXCLUDED_PATH_PARTS.some((part) => normalized.includes(part));
}

function relativeSource(filePath) {
  return path.relative(sourceRoot, filePath).replace(/\//g, '\\');
}

function classify(relativePath) {
  const fileName = path.basename(relativePath);
  const baseModelTypes = {
    'CardModel.cs': ['CARD'],
    'CardPoolModel.cs': ['CARD'],
    'RelicModel.cs': ['RELIC'],
    'RelicPoolModel.cs': ['RELIC'],
    'PowerModel.cs': ['BUFF'],
    'EventModel.cs': ['EVENT'],
    'AncientEventModel.cs': ['ANCIENT'],
    'CharacterModel.cs': ['CHARACTER'],
    'MonsterModel.cs': ['MONSTER', 'BOSS'],
    'EncounterModel.cs': ['MONSTER', 'BOSS'],
    'PotionModel.cs': [],
    'PotionPoolModel.cs': [],
    'EnchantmentModel.cs': [],
    'ActModel.cs': ['EVENT', 'ANCIENT'],
  };
  if (baseModelTypes[fileName]) {
    return { kind: 'MODEL', types: baseModelTypes[fileName] };
  }
  if (relativePath.includes('\\Commands\\')) return { kind: 'COMMAND', types: [] };
  if (relativePath.includes('\\CardPools\\')) return { kind: 'POOL', types: ['CARD'] };
  if (relativePath.includes('\\RelicPools\\')) return { kind: 'POOL', types: ['RELIC'] };
  if (relativePath.includes('\\PotionPools\\')) return { kind: 'POOL', types: [] };
  if (relativePath.includes('\\Models\\Cards\\')) return { kind: 'EXAMPLE', types: [] };
  if (relativePath.includes('\\Models\\Relics\\')) return { kind: 'EXAMPLE', types: [] };
  if (relativePath.includes('\\Models\\Powers\\')) return { kind: 'EXAMPLE', types: [] };
  if (relativePath.includes('\\Models\\Events\\')) return { kind: 'EXAMPLE', types: [] };
  if (relativePath.includes('\\Models\\Monsters\\')) return { kind: 'EXAMPLE', types: [] };
  if (relativePath.includes('\\Models\\Encounters\\')) return { kind: 'EXAMPLE', types: [] };
  if (relativePath.includes('\\Models\\Characters\\')) return { kind: 'EXAMPLE', types: [] };
  if (relativePath.includes('\\Models\\Potions\\')) return { kind: 'EXAMPLE', types: [] };
  if (relativePath.includes('\\Models\\Enchantments\\')) return { kind: 'EXAMPLE', types: [] };
  if (relativePath.includes('\\Localization\\DynamicVars\\')) {
    return { kind: 'DYNAMIC_VAR', types: [] };
  }
  if (relativePath.includes('\\MonsterMoves\\')) return { kind: 'MONSTER_MOVE', types: ['MONSTER', 'BOSS'] };
  if (relativePath.includes('\\Entities\\Cards\\')) return { kind: 'ENUM', types: ['CARD'] };
  if (relativePath.includes('\\Entities\\Relics\\')) return { kind: 'ENUM', types: ['RELIC'] };
  if (relativePath.includes('\\Entities\\Potions\\')) return { kind: 'ENUM', types: [] };
  if (relativePath.includes('\\Entities\\Powers\\')) return { kind: 'ENUM', types: ['BUFF'] };
  if (relativePath.includes('\\Entities\\Ancients\\')) return { kind: 'ENUM', types: ['ANCIENT'] };
  if (relativePath.includes('\\Entities\\Creatures\\')) return { kind: 'ENUM', types: ['MONSTER', 'BOSS'] };
  if (relativePath.includes('\\Entities\\Enchantments\\')) return { kind: 'ENUM', types: [] };
  if (relativePath.includes('\\Entities\\Multiplayer\\')) return { kind: 'ENUM', types: ['CARD'] };
  if (relativePath.includes('\\Entities\\')) return { kind: 'GENERAL', types: [] };
  return { kind: 'MODEL', types: [] };
}

function typeKeywords(name, baseName, kind, types) {
  const keywords =
    kind === 'EXAMPLE' || kind === 'ENUM' || kind === 'MONSTER_MOVE'
      ? new Set()
      : kind === 'POOL'
        ? new Set(['卡池', '池', '注册'])
        : new Set(types.flatMap((type) => TYPE_KEYWORDS[type] || []));
  if (kind === 'COMMAND') {
    for (const keyword of COMMAND_KEYWORDS[name] || []) keywords.add(keyword);
  }
  if (name === 'AncientEventModel') keywords.add('先古之民');
  if (name === 'EventModel') keywords.add('事件');
  if (name === 'MonsterModel') keywords.add('怪物');
  if (name === 'EncounterModel') keywords.add('遭遇');
  if (baseName.includes('Power')) keywords.add('buff');
  return [...keywords];
}

function extractDoc(text, index) {
  const lines = text.slice(0, index).split(/\r?\n/);
  const doc = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const line = lines[i].trim();
    if (!line.startsWith('///')) break;
    doc.unshift(line.replace(/^\/\/\/\s?/, ''));
  }
  return doc.join(' ').trim();
}

function cleanMember(line) {
  return line
    .replace(/\s+/g, ' ')
    .replace(/\s*\{.*$/, '')
    .replace(/\s*=>.*$/, ' => ...')
    .replace(/\[[^\]]+\]\s*/g, '')
    .trim()
    .slice(0, 260);
}

function extractTypeEntries(filePath) {
  const text = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
  const relativePath = relativeSource(filePath);
  const namespace = text.match(/^\s*namespace\s+([A-Za-z0-9_.]+)/m)?.[1] || '';
  const classInfo = classify(relativePath);
  const typeRegex =
    /^\s*(?:public|internal)\s+(?:(?:abstract|sealed|static|partial|readonly)\s+)*(class|record|enum|interface|struct)\s+([A-Za-z_][A-Za-z0-9_]*)[^:\r\n{]*?(?:\s*:\s*([^{\r\n]+))?/gm;
  const matches = [...text.matchAll(typeRegex)];
  const entries = [];
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const name = match[2];
    if (/^(Mock|Deprecated)/.test(name)) continue;
    const kind = match[1];
    const bases = (match[3] || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const start = match.index || 0;
    const end = index + 1 < matches.length ? matches[index + 1].index || text.length : text.length;
    const block = text.slice(start, end);
    const summary = extractDoc(text, start);
    let members = [];
    if (kind === 'enum') {
      members = block
        .split(/\r?\n/)
        .filter((line) => /^\s*[A-Z][A-Za-z0-9_]*\s*(?:=\s*[^,\r\n]+)?\s*,?\s*$/.test(line))
        .slice(0, 50)
        .map((line) => `ENUM ${cleanMember(line).replace(/,$/, '')}`);
    } else {
      members = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(
          (line) =>
            /^(public|protected|internal)\s+/.test(line) &&
            !/^(public|protected|internal)\s+(?:(?:abstract|sealed|static|partial|readonly)\s+)*(class|record|enum|interface|struct)\s+/.test(line),
        )
        .map(cleanMember)
        .filter((line) => line && !line.includes('_003C'))
        .slice(0, 24);
    }
    const declaration = `${kind} ${name}${bases.length ? ` : ${bases.join(', ')}` : ''}`;
    const shortSummary = (summary || `${name} 位于 ${relativePath}。`).slice(0, 300);
    const facts = [
      `${name} 定义：${declaration}。`,
      shortSummary,
      ...members.map((member) => member),
    ].slice(0, 20);
    const baseName = bases[0] || kind;
    const primaryModels = new Set([
      'CardModel',
      'RelicModel',
      'PowerModel',
      'EventModel',
      'AncientEventModel',
      'CharacterModel',
      'MonsterModel',
      'EncounterModel',
    ]);
    const priority =
      classInfo.kind === 'MODEL'
        ? primaryModels.has(name)
          ? 12
          : name.endsWith('PoolModel')
            ? 6
            : 3
        : classInfo.kind === 'COMMAND'
          ? 8
          : classInfo.kind === 'POOL'
            ? 3
            : classInfo.kind === 'DYNAMIC_VAR'
              ? 5
              : classInfo.kind === 'ENUM' || classInfo.kind === 'MONSTER_MOVE'
                ? 3
                : 0;
    entries.push({
      id: `source:${relativePath}:${name}`,
      title: `${name} - ${classInfo.kind}`,
      kind: classInfo.kind,
      types: classInfo.types,
      keywords: typeKeywords(name, baseName, classInfo.kind, classInfo.types),
      priority,
      facts,
      anchors: [name],
      risks: [],
      suggestions: [],
      source: relativePath,
      namespace,
      declaration,
    });
  }
  return entries;
}

function toPascalCase(value) {
  return String(value)
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function stripRichText(value) {
  return String(value || '')
    .replace(/\[\/?[a-z]+(?:=[^\]]+)?\]/gi, '')
    .replace(/\{[^}]+\}/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractGlossaryEntries() {
  const entries = [];
  for (const source of GLOSSARY_SOURCES) {
    const filePath = path.join(sourceRoot, source.file);
    if (!fs.existsSync(filePath)) continue;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
    const keys = new Set();
    for (const key of Object.keys(data)) {
      const match = key.match(/^([A-Z0-9_]+)\.(title|description)$/);
      if (!match) continue;
      if (source.includeKeys && !source.includeKeys.has(match[1])) continue;
      keys.add(match[1]);
    }
    for (const key of keys) {
      const rawTitle = data[`${key}.title`];
      const rawDescription = data[`${key}.description`];
      if (!rawTitle || !rawDescription) continue;
      const title = stripRichText(rawTitle);
      const description = stripRichText(rawDescription);
      const anchor = `${source.anchorPrefix}.${toPascalCase(key)}`;
      entries.push({
        id: `glossary:${source.file}:${key}`,
        title: `${title} / ${key}`,
        kind: source.kind,
        types: source.types,
        keywords: [title, key, anchor],
        priority: source.priority,
        facts: [
          `${key} 是游戏内部标识，官方中文显示名为“${title}”。`,
          `官方中文描述：${description}`,
          `说明：${description.replace(/\.$/, '')}`,
        ],
        anchors: [anchor],
        risks: [],
        suggestions: [],
        source: source.file.replace(/\\/g, '\\'),
        namespace: 'MegaCrit.Sts2.Core.Localization',
        declaration: `${source.kind} ${key} => ${title}`,
      });
    }
  }
  return entries;
}

function shouldIncludeRuntime(entry) {
  const fileName = path.basename(entry.source);
  if (BASE_MODEL_FILES.has(fileName)) return true;
  if (
    ['COMMAND', 'POOL', 'DYNAMIC_VAR', 'MONSTER_MOVE', 'ENUM', 'CARD_KEYWORD', 'GLOSSARY'].includes(
      entry.kind,
    )
  ) {
    return true;
  }
  for (const [directory, names] of Object.entries(EXAMPLE_NAMES_BY_DIR)) {
    if (entry.source.includes(directory) && names.includes(entry.title.split(' - ')[0])) {
      return true;
    }
  }
  return false;
}

function main() {
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`STS2 source root not found: ${sourceRoot}`);
  }
  const files = SOURCE_DIRS.flatMap((directory) => walk(path.join(sourceRoot, directory)))
    .filter((filePath) => !isExcluded(filePath))
    .sort();
  const sourceEntries = [...files.flatMap(extractTypeEntries).reduce((map, entry) => {
    if (!map.has(entry.id)) map.set(entry.id, entry);
    return map;
  }, new Map()).values()];
  const entries = [...sourceEntries, ...extractGlossaryEntries()];
  const runtimeEntries = entries.filter(shouldIncludeRuntime);
  const generatedAt = new Date().toISOString();

  const fullOutput = {
    schemaVersion: 1,
    sourceType: 'local_decompiled_index',
    sourceRootName: path.basename(sourceRoot),
    generatedAt,
    fileCount: files.length,
    entryCount: entries.length,
    entries,
  };
  const runtimeOutput = {
    schemaVersion: 1,
    sourceType: 'curated_runtime_index',
    sourceRootName: path.basename(sourceRoot),
    generatedAt,
    entryCount: runtimeEntries.length,
    entries: runtimeEntries,
  };

  const fullPath = path.join(repoRoot, 'knowledge', 'sl2-source-index.json');
  const runtimePath = path.join(
    repoRoot,
    'cloudfunctions',
    'evaluationRunner',
    'knowledge',
    'catalog.json',
  );
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.mkdirSync(path.dirname(runtimePath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(fullOutput, null, 2)}\n`, 'utf8');
  fs.writeFileSync(runtimePath, `${JSON.stringify(runtimeOutput, null, 2)}\n`, 'utf8');

  console.log(
    `Generated ${entries.length} source entries (${runtimeEntries.length} runtime entries).`,
  );
  console.log(fullPath);
  console.log(runtimePath);
}

main();
