const assert = require('node:assert/strict');
const { analyze } = require('../cloudfunctions/evaluationRunner/lib/rules');
const { retrieveKnowledge } = require('../cloudfunctions/evaluationRunner/lib/knowledge');
const {
  parseJsonCandidate,
  sanitizeModelResult,
} = require('../cloudfunctions/evaluationRunner/lib/schema');
const { publicSubmission } = require('../cloudfunctions/api/lib/core');

function baseSubmission(overrides = {}) {
  return {
    type: 'CARD',
    name: '飞刀连击',
    designText:
      '对指定敌人造成 6 点伤害。如果本回合已经打出过攻击牌，则再次造成一次伤害。升级后第一段伤害提高 2 点。',
    resourceUrl: '',
    extra: {
      cost: '1',
      cardType: '攻击',
      targetType: '指定敌人',
      upgrade: '第一段伤害 6 -> 8',
    },
    ...overrides,
  };
}

const card = analyze(baseSubmission());
assert.equal(card.difficulty.level, 'MEDIUM');
assert.ok(card.reasons.some((item) => item.includes('多段')));
assert.ok(card.technicalAnchors.some((item) => item.name === 'CardModel'));

const snippets = retrieveKnowledge(baseSubmission(), card);
assert.ok(snippets.some((item) => item.id === 'card-core'));
assert.ok(snippets.some((item) => item.id === 'multi-hit'));

const boss = analyze(
  baseSubmission({
    type: 'BOSS',
    name: '双层核心',
    designText:
      'Boss 拥有两个阶段和三种意图。第一阶段召唤两名小怪，生命降到一半后进入第二阶段，改变全部攻击模式并播放专属音乐。',
    extra: {
      chapter: '第三章',
      phases: '2',
      encounter: '单独遭遇',
      music: '需要专属音乐',
    },
  }),
);
assert.ok(['HARD', 'EXTREME'].includes(boss.difficulty.level));
assert.ok(boss.difficulty.score > card.difficulty.score);

const vague = analyze(
  baseSubmission({
    type: 'CHARACTER',
    designText: '设计一个拥有全新资源的角色，具体卡牌以后再说。',
    extra: {},
  }),
);
assert.ok(vague.missingInformation.length >= 1);
assert.ok(vague.difficulty.confidence < 0.7);

const eternal = analyze(
  baseSubmission({
    type: 'RELIC',
    name: '永恒印记',
    designText: '卡组里的所有牌获得永恒，同时能量上限加一。',
    extra: { rarity: '罕见', acquisition: '商店' },
  }),
);
assert.ok(eternal.reasons.some((item) => item.includes('CardKeyword.Eternal')));
assert.ok(eternal.risks.some((item) => item.includes('整副牌组')));

const parsed = parseJsonCandidate('```json\n{"difficulty":"MEDIUM","score":42}\n```');
assert.equal(parsed.score, 42);

const sanitized = sanitizeModelResult(
  {
    difficulty: 'HARD',
    score: 62,
    confidence: 0.81,
    summary: '需要新增状态和选择界面。',
    reasons: ['涉及新状态', '包含选择交互'],
    risks: ['多人同步需要验证'],
    suggestions: ['补充升级数值'],
    missingInformation: ['升级后的具体数值', '请选择使用哪个钩子实现'],
    technicalAnchors: [
      { kind: 'MODEL', name: 'CardModel', usage: '卡牌主体', confidence: 0.9 },
      { kind: 'MODEL', name: 'UnknownModel', usage: '非法接口', confidence: 0.9 },
    ],
    dimensions: card.dimensions,
  },
  card,
);
assert.equal(sanitized.technicalAnchors.length, 1);
assert.equal(sanitized.difficulty.label, '困难');
assert.ok(sanitized.implementationBrief.length > 0);
assert.deepEqual(sanitized.missingInformation, ['升级后的具体数值']);

const publicDraft = publicSubmission({
  _id: 'submission_test',
  type: 'CARD',
  name: '测试卡牌',
  designText: '一段足够长的测试设计描述，用于检查提交和评估状态是否已经解耦。',
  extra: {},
  status: 'DRAFT',
  evaluationStatus: 'SUCCEEDED',
  contentVersion: 1,
  contentHash: 'hash',
});
assert.equal(publicDraft.status, 'DRAFT');
assert.equal(publicDraft.evaluationStatus, 'SUCCEEDED');

const migratedLegacy = publicSubmission({
  _id: 'submission_legacy',
  type: 'CARD',
  name: '旧记录',
  designText: '一段足够长的旧测试设计描述，用于检查历史状态映射是否正确。',
  extra: {},
  status: 'EVALUATED',
  contentVersion: 1,
  contentHash: 'hash',
  latestEvaluationId: 'evaluation_legacy',
});
assert.equal(migratedLegacy.status, 'DRAFT');
assert.equal(migratedLegacy.evaluationStatus, 'SUCCEEDED');

console.log('smoke-test: all checks passed');
