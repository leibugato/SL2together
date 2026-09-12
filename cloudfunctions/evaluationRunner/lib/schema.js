const { DIFFICULTY_LABELS, TYPE_ANCHORS, difficultyFromScore } = require('./rules');

const DIFFICULTIES = Object.keys(DIFFICULTY_LABELS);
const DIMENSION_KEYS = [
  'apiFit',
  'logicComplexity',
  'integrationScope',
  'visualAssets',
  'compatibility',
  'versionStability',
];
const ANCHOR_WHITELIST = new Set(
  Object.values(TYPE_ANCHORS)
    .flat()
    .map((anchor) => anchor.name),
);

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function cleanStrings(value, maxItems, maxLength) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === 'string')
    .map((item) => item.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
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
    const max = key === 'apiFit' ? 25 : key === 'logicComplexity' ? 20 : key === 'versionStability' ? 10 : 15;
    const number = Number(value[key]);
    result[key] = Number.isFinite(number) ? clamp(Math.round(number), 0, max) : Number(fallback.dimensions[key] || 0);
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
  const score = clamp(Math.round(Number(raw.score)), 0, 100);
  const confidence = clamp(Number(raw.confidence), 0, 1);
  if (!Number.isFinite(score) || !Number.isFinite(confidence)) {
    return null;
  }
  const level = DIFFICULTIES.includes(raw.difficulty) ? raw.difficulty : difficultyFromScore(score);
  const reasons = cleanStrings(raw.reasons, 6, 300);
  const summary = String(raw.summary || '').trim().slice(0, 600);
  const implementationBrief = String(
    raw.implementationBrief || fallback.implementationBrief || '',
  )
    .trim()
    .slice(0, 600);
  if (!summary || reasons.length < 1) {
    return null;
  }
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
    risks: cleanStrings(raw.risks, 5, 300),
    suggestions: cleanStrings(raw.suggestions, 5, 300),
    missingInformation: cleanMissingInformation(raw.missingInformation, 8),
    technicalAnchors: sanitizeTechnicalAnchors(raw.technicalAnchors, fallback),
    dimensions: sanitizeDimensions(raw.dimensions, fallback),
  };
}

module.exports = {
  parseJsonCandidate,
  sanitizeModelResult,
};
