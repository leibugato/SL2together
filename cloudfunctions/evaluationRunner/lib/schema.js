const { DIFFICULTY_LABELS, TYPE_ANCHORS, difficultyFromScore } = require('./rules');

const DIMENSION_KEYS = [
  'apiFit',
  'logicComplexity',
  'integrationScope',
  'visualAssets',
  'compatibility',
  'versionStability',
];
const DIMENSION_MAX = {
  apiFit: 25,
  logicComplexity: 20,
  integrationScope: 15,
  visualAssets: 15,
  compatibility: 15,
  versionStability: 10,
};
const MODEL_EXTRA_CAPS = {
  apiFit: 6,
  logicComplexity: 6,
  integrationScope: 4,
  visualAssets: 4,
  compatibility: 4,
  versionStability: 3,
};
const ANCHOR_WHITELIST = new Set(
  Object.values(TYPE_ANCHORS)
    .flat()
    .map((anchor) => anchor.name),
);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function dedupeStrings(value) {
  const seen = new Set();
  return value.filter((item) => {
    const key = item.replace(/\s+/g, '').slice(0, 80);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function cleanStrings(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  const cleaned = value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
  return dedupeStrings(cleaned);
}

function cleanMissingInformation(value, maxItems) {
  return cleanStrings(value, maxItems, 160).filter(
    (item) =>
      !/请.{0,12}(钩子|字段|类名|具体实现|代码)|使用.{0,20}(钩子|字段|Buff|PowerModel)|直接修改.{0,12}(字段|上限)/i.test(
        item,
      ),
  );
}

function parseJsonCandidate(content) {
  const text = String(content || '').trim();
  if (!text) return null;
  const withoutFence = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch (error) {
    const start = withoutFence.indexOf('{');
    const end = withoutFence.lastIndexOf('}');
    if (start < 0 || end <= start) return null;
    try {
      return JSON.parse(withoutFence.slice(start, end + 1));
    } catch (innerError) {
      return null;
    }
  }
}

function sanitizeDimensions(value, fallback) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return fallback.dimensions;
  }
  return DIMENSION_KEYS.reduce((result, key) => {
    const max = DIMENSION_MAX[key];
    const number = Number(value[key]);
    const baseline = clamp(Number(fallback.dimensions?.[key] || 0), 0, max);
    result[key] = Number.isFinite(number)
      ? clamp(
          Math.round(
            baseline * 0.85 +
              clamp(number, 0, Math.min(max, baseline + MODEL_EXTRA_CAPS[key])) * 0.15,
          ),
          0,
          max,
        )
      : baseline;
    return result;
  }, {});
}

function sanitizeTechnicalAnchors(value, fallback) {
  if (!Array.isArray(value)) return fallback.technicalAnchors;
  const anchors = value
    .filter((item) => item && typeof item === 'object' && ANCHOR_WHITELIST.has(item.name))
    .map((item) => ({
      kind: String(item.kind || 'MODEL').slice(0, 30),
      name: String(item.name),
      usage: String(item.usage || '').trim().slice(0, 160),
      confidence: clamp(Number(item.confidence || 0.7), 0, 1),
    }))
    .slice(0, 8);
  return anchors.length ? anchors : fallback.technicalAnchors;
}

function sanitizeModelResult(raw, fallback) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  if (!Number.isFinite(Number(raw.score))) {
    return null;
  }
  const dimensions = sanitizeDimensions(raw.dimensions, fallback);
  const score = clamp(
    Object.values(dimensions).reduce((sum, value) => sum + Number(value || 0), 0),
    0,
    100,
  );
  const level = difficultyFromScore(score);
  const reasons = cleanStrings(raw.reasons, 4, 180);
  const summary = String(raw.summary || '').trim().slice(0, 360);
  const implementationBrief = String(
    raw.implementationBrief || fallback.implementationBrief || '',
  )
    .trim()
    .slice(0, 320);
  if (!summary || reasons.length < 1) {
    return null;
  }
  const missingInformation = cleanMissingInformation(raw.missingInformation, 4);
  const ruleConfidence = clamp(Number(fallback.difficulty?.confidence ?? 0.5), 0, 1);
  const rawConfidence = Number(raw.confidence);
  const modelConfidence = Number.isFinite(rawConfidence)
    ? clamp(rawConfidence, 0, 1)
    : ruleConfidence;
  const confidence = clamp(
    modelConfidence * 0.55 + ruleConfidence * 0.45 - missingInformation.length * 0.02,
    0.25,
    0.95,
  );
  return {
    difficulty: {
      level,
      label: DIFFICULTY_LABELS[level],
      score,
      confidence: Number(confidence.toFixed(2)),
      provisional: Boolean(raw.provisional) || confidence < 0.55,
    },
    summary,
    implementationBrief,
    reasons,
    risks: cleanStrings(raw.risks, 4, 180),
    suggestions: cleanStrings(raw.suggestions, 4, 180),
    missingInformation,
    technicalAnchors: sanitizeTechnicalAnchors(raw.technicalAnchors, fallback),
    dimensions,
    modGeneration: fallback.modGeneration || {
      supported: false,
      reason: '当前评估结果没有可用的自动生成规格。',
      spec: null,
    },
  };
}

module.exports = {
  parseJsonCandidate,
  sanitizeModelResult,
};
