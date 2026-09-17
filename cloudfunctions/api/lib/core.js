const crypto = require('crypto');

const MOD_SPEC_VERSION = 'modspec-v3';

const IDEA_TYPES = [
  'CARD',
  'RELIC',
  'EVENT',
  'CHARACTER',
  'ANCIENT',
  'SKIN',
  'MONSTER',
  'BOSS',
  'VOICE',
  'BUFF',
];

const SUBMISSION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
];

const EVALUATION_STATUSES = [
  'NOT_EVALUATED',
  'QUEUED',
  'RUNNING',
  'RETRYING',
  'SUCCEEDED',
  'FAILED',
];

const JOB_STATUSES = ['QUEUED', 'RUNNING', 'RETRYING', 'SUCCEEDED', 'FAILED'];

const TYPE_EXTRA_KEYS = {
  CARD: ['cost', 'cardType', 'targetType', 'rarity', 'upgrade'],
  RELIC: ['rarity', 'acquisition', 'trigger'],
  EVENT: ['chapter', 'optionCount', 'reward'],
  CHARACTER: ['resource', 'startingDeck', 'startingRelic', 'keywords'],
  ANCIENT: ['chapter', 'relicCount', 'dialogueScale'],
  SKIN: ['target', 'assetScale', 'animation'],
  MONSTER: ['chapter', 'behavior', 'intentCount', 'scene'],
  BOSS: ['chapter', 'phases', 'encounter', 'music'],
  VOICE: ['character', 'lines', 'triggerScope', 'language'],
  BUFF: ['polarity', 'stackType', 'duration', 'trigger'],
};

class AppError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.retryable = retryable;
  }
}

function createRequestId() {
  return `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function success(data, requestId) {
  return {
    ok: true,
    data,
    requestId,
  };
}

function failure(error, requestId) {
  const known = error instanceof AppError;
  const isDevelopment = process.env.APP_ENV !== 'prod';
  const fallbackMessage = isDevelopment
    ? `调试错误：${error?.message || '未知错误'}`
    : '服务暂时不可用，请稍后重试。';
  return {
    ok: false,
    error: {
      code: known ? error.code : error?.errCode || 'INTERNAL_ERROR',
      message: known ? error.message : fallbackMessage,
      retryable: known ? error.retryable : false,
    },
    requestId,
  };
}

function assert(condition, code, message, retryable = false) {
  if (!condition) {
    throw new AppError(code, message, retryable);
  }
}

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeResourceUrl(value) {
  const url = cleanText(value, 500);
  if (!url) return '';
  assert(/^https?:\/\/[^\s]+$/i.test(url), 'VALIDATION_ERROR', '资源链接需要以 http:// 或 https:// 开头。');
  return url;
}

function normalizeExtra(type, extra) {
  const source = extra && typeof extra === 'object' && !Array.isArray(extra) ? extra : {};
  const keys = TYPE_EXTRA_KEYS[type] || [];
  const result = {};
  for (const key of keys) {
    const value = source[key];
    if (value === undefined || value === null) continue;
    if (typeof value === 'boolean' || typeof value === 'number') {
      result[key] = value;
    } else {
      const text = cleanText(value, 500);
      if (text) result[key] = text;
    }
  }
  return result;
}

function normalizeForm(form) {
  assert(form && typeof form === 'object' && !Array.isArray(form), 'VALIDATION_ERROR', '设计表单格式不正确。');
  assert(IDEA_TYPES.includes(form.type), 'VALIDATION_ERROR', '请选择有效的内容类型。');
  const name = String(form.name || '').trim();
  const designText = String(form.designText || '').trim();
  assert(name.length >= 1, 'VALIDATION_ERROR', '名称不能为空。');
  assert(name.length <= 60, 'VALIDATION_ERROR', '名称不能超过 60 个字符。');
  assert(designText.length >= 20, 'VALIDATION_ERROR', '描述与设计至少需要 20 个字符。');
  assert(designText.length <= 5000, 'VALIDATION_ERROR', '描述与设计不能超过 5000 个字符。');
  return {
    type: form.type,
    name,
    designText,
    resourceUrl: normalizeResourceUrl(form.resourceUrl),
    extra: normalizeExtra(form.type, form.extra),
  };
}

function sortedObject(value) {
  if (Array.isArray(value)) {
    return value.map(sortedObject);
  }
  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortedObject(value[key]);
        return result;
      }, {});
  }
  return value;
}

function contentHash(form) {
  const normalized = normalizeForm(form);
  const payload = JSON.stringify(sortedObject(normalized));
  return crypto.createHash('sha256').update(payload).digest('hex');
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value.$date) return new Date(value.$date).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function publicUser(user) {
  return {
    nickname: user.nickname || '',
    avatarUrl: user.avatarUrl || '',
    createdAt: toIso(user.createdAt),
  };
}

function publicSubmission(submission) {
  const status = submission.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT';
  let evaluationStatus = submission.evaluationStatus;
  if (!EVALUATION_STATUSES.includes(evaluationStatus)) {
    if (submission.status === 'EVALUATED') evaluationStatus = 'SUCCEEDED';
    else if (submission.status === 'EVALUATING') evaluationStatus = 'RUNNING';
    else if (submission.status === 'EVALUATION_FAILED') evaluationStatus = 'FAILED';
    else evaluationStatus = submission.latestEvaluationId ? 'SUCCEEDED' : 'NOT_EVALUATED';
  }
  return {
    _id: submission._id,
    type: submission.type,
    name: submission.name,
    designText: submission.designText,
    resourceUrl: submission.resourceUrl || '',
    extra: submission.extra || {},
    status,
    evaluationStatus,
    contentVersion: submission.contentVersion || 1,
    contentHash: submission.contentHash,
    latestEvaluationId: submission.latestEvaluationId || null,
    latestEvaluation: submission.latestEvaluation || null,
    createdAt: toIso(submission.createdAt),
    updatedAt: toIso(submission.updatedAt),
    submittedAt: toIso(submission.submittedAt),
    deletedAt: toIso(submission.deletedAt),
  };
}

function publicEvaluation(evaluation) {
  if (!evaluation) return null;
  return {
    _id: evaluation._id,
    submissionId: evaluation.submissionId,
    contentVersion: evaluation.contentVersion,
    contentHash: evaluation.contentHash,
    difficulty: evaluation.difficulty,
    summary: evaluation.summary,
    implementationBrief: evaluation.implementationBrief || '',
    reasons: evaluation.reasons || [],
    risks: evaluation.risks || [],
    suggestions: evaluation.suggestions || [],
    missingInformation: evaluation.missingInformation || [],
    technicalAnchors: evaluation.technicalAnchors || [],
    dimensions: evaluation.dimensions || {},
    modGeneration: evaluation.modGeneration || null,
    model: evaluation.model || {},
    createdAt: toIso(evaluation.createdAt),
  };
}

function publicJob(job) {
  if (!job) return null;
  return {
    _id: job._id,
    submissionId: job.submissionId,
    contentHash: job.contentHash,
    status: job.status,
    attempts: job.attempts || 0,
    maxAttempts: job.maxAttempts || 3,
    errorCode: job.errorCode || null,
    errorMessage: job.errorMessage || null,
  };
}

function isCollectionExistsError(error) {
  const message = String(error && (error.errMsg || error.message || error));
  return /already exists|already exist|collection.*exist|集合.*存在/i.test(message);
}

async function ensureCollection(db, name) {
  try {
    await db.createCollection(name);
  } catch (error) {
    if (!isCollectionExistsError(error)) {
      throw error;
    }
  }
}

async function getOwnedSubmission(db, openid, id) {
  assert(id && typeof id === 'string', 'VALIDATION_ERROR', '缺少提交 ID。');
  try {
    const result = await db.collection('submissions').doc(id).get();
    const submission = result.data;
    if (!submission || submission._openid !== openid || submission.deletedAt) {
      throw new AppError('NOT_FOUND', '记录不存在或无权访问。');
    }
    return submission;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError('NOT_FOUND', '记录不存在或无权访问。');
  }
}

function getCatalogVersion() {
  return process.env.CATALOG_VERSION || 'sts2-api-2026.09-r4';
}

function getPromptVersion() {
  return process.env.PROMPT_VERSION || 'eval-v4';
}

function getMaxDailyEvaluations() {
  const value = Number(process.env.MAX_DAILY_EVALUATIONS || 20);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 20;
}

function getTodayKey() {
  const now = new Date(Date.now() + 8 * 60 * 60 * 1000);
  return now.toISOString().slice(0, 10);
}

module.exports = {
  IDEA_TYPES,
  SUBMISSION_STATUSES,
  EVALUATION_STATUSES,
  JOB_STATUSES,
  MOD_SPEC_VERSION,
  AppError,
  assert,
  cleanText,
  contentHash,
  createRequestId,
  ensureCollection,
  failure,
  getCatalogVersion,
  getMaxDailyEvaluations,
  getOwnedSubmission,
  getPromptVersion,
  getTodayKey,
  normalizeForm,
  publicEvaluation,
  publicJob,
  publicSubmission,
  publicUser,
  success,
  toIso,
};
