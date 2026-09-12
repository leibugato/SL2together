const assert = require('node:assert/strict');
const catalog = require('../cloudfunctions/evaluationRunner/knowledge/catalog.json');
const {
  KNOWLEDGE_ENTRIES,
  retrieveKnowledge,
} = require('../cloudfunctions/evaluationRunner/lib/knowledge');
const { analyze } = require('../cloudfunctions/evaluationRunner/lib/rules');

assert.ok(Array.isArray(catalog.entries), 'catalog.entries must be an array');
assert.ok(catalog.entries.length >= 100, 'runtime catalog is unexpectedly small');
assert.ok(KNOWLEDGE_ENTRIES.length > catalog.entries.length, 'curated entries were not merged');

const names = new Set(catalog.entries.map((entry) => entry.anchors[0]));
for (const required of [
  'CardModel',
  'RelicModel',
  'PowerModel',
  'EventModel',
  'AncientEventModel',
  'MonsterModel',
  'EncounterModel',
  'CharacterModel',
  'DamageCmd',
  'CardPileCmd',
  'PowerCmd',
  'CardPoolModel',
  'RelicPoolModel',
]) {
  assert.ok(names.has(required), `missing required source entry: ${required}`);
}
assert.ok(names.has('CardKeyword.Eternal'), 'missing Eternal keyword glossary');
assert.ok(names.has('CardKeyword.Exhaust'), 'missing Exhaust keyword glossary');

for (const entry of catalog.entries) {
  assert.ok(entry.id && entry.title && entry.source, `invalid generated entry: ${entry.id}`);
  assert.ok(!/^[A-Za-z]:\\/.test(entry.source), `source path must be relative: ${entry.source}`);
  assert.ok(
    (entry.facts || []).every((fact) => typeof fact === 'string' && fact.length <= 300),
    `generated fact is too long: ${entry.id}`,
  );
}

const submission = {
  type: 'CARD',
  name: '连击测试',
  designText: '对敌人造成 6 点伤害，然后再次造成一次伤害。升级后提高第一段伤害。',
  resourceUrl: '',
  extra: { cost: '1', cardType: '攻击', targetType: '敌人' },
};
const snippets = retrieveKnowledge(submission, analyze(submission));
assert.ok(snippets.length > 0);
assert.ok(snippets.some((entry) => entry.anchors.includes('CardModel') || entry.anchors.includes('DamageCmd')));

const keywordSubmission = {
  type: 'RELIC',
  name: '永恒印记',
  designText: '卡组里的所有牌获得永恒，同时能量上限加一。',
  resourceUrl: '',
  extra: { rarity: '罕见', acquisition: '商店' },
};
const keywordSnippets = retrieveKnowledge(keywordSubmission, analyze(keywordSubmission));
assert.ok(
  keywordSnippets.some(
    (entry) =>
      entry.facts.some((fact) => fact.includes('无法从你的牌组中移除或变化')) ||
      entry.anchors.includes('CardKeyword.Eternal'),
  ),
  'Chinese Eternal keyword was not mapped to CardKeyword.Eternal',
);

console.log(
  `knowledge-check: ${KNOWLEDGE_ENTRIES.length} merged entries, ${catalog.entries.length} source entries`,
);
