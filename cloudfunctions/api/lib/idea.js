const {
  AppError,
  assert,
  contentHash,
  ensureCollection,
  getOwnedSubmission,
  normalizeForm,
  publicEvaluation,
  publicSubmission,
  toIso,
} = require('./core');
const {
  createShareCode,
  getShareExpiry,
  normalizeShareCode,
} = require('./share');

async function listMine(db, openid, event) {
  const page = Math.max(0, Math.floor(Number(event.page || 0)));
  const pageSize = Math.min(30, Math.max(1, Math.floor(Number(event.pageSize || 10))));
  const where = {
    _openid: openid,
    deletedAt: null,
  };
  if (event.type) where.type = event.type;
  if (event.status) where.status = event.status;
  if (event.evaluationStatus) where.evaluationStatus = event.evaluationStatus;
  if (event.difficulty) where['latestEvaluation.difficulty.level'] = event.difficulty;

  const collection = db.collection('submissions');
  const [listResult, countResult] = await Promise.all([
    collection
      .where(where)
      .orderBy('updatedAt', 'desc')
      .skip(page * pageSize)
      .limit(pageSize)
      .get(),
    collection.where(where).count(),
  ]);

  return {
    items: listResult.data.map(publicSubmission),
    total: countResult.total,
    page,
    pageSize,
  };
}

async function getMine(db, openid, event) {
  const submission = await getOwnedSubmission(db, openid, event.id);
  let evaluation = null;
  if (submission.latestEvaluationId) {
    try {
      const result = await db.collection('evaluations').doc(submission.latestEvaluationId).get();
      evaluation = result.data || null;
    } catch (error) {
      evaluation = null;
    }
  }
  if (!evaluation) {
    const result = await db
      .collection('evaluations')
      .where({
        _openid: openid,
        submissionId: submission._id,
      })
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    evaluation = result.data[0] || null;
  }
  const evaluationStale = Boolean(evaluation && evaluation.contentHash !== submission.contentHash);
  return {
    submission: publicSubmission(submission),
    evaluation: publicEvaluation(evaluation),
    evaluationStale,
  };
}

async function create(db, openid, event) {
  await ensureCollection(db, 'submissions');
  const form = normalizeForm(event.form);
  const status = event.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT';
  const now = db.serverDate();
  const result = await db.collection('submissions').add({
    data: {
      _openid: openid,
      ...form,
      status,
      evaluationStatus: 'NOT_EVALUATED',
      contentVersion: 1,
      contentHash: contentHash(form),
      latestEvaluationId: null,
      latestEvaluation: null,
      createdAt: now,
      updatedAt: now,
      submittedAt: status === 'SUBMITTED' ? now : null,
      deletedAt: null,
    },
  });
  const created = await db.collection('submissions').doc(result._id).get();
  return {
    submission: publicSubmission(created.data),
  };
}

async function update(db, openid, event) {
  const current = await getOwnedSubmission(db, openid, event.id);
  const expectedVersion = Number(event.expectedVersion || 0);
  if (expectedVersion && expectedVersion !== current.contentVersion) {
    throw new AppError('CONFLICT', '记录已在其他页面更新，请重新打开后再编辑。');
  }

  const form = normalizeForm(event.form);
  const nextHash = contentHash(form);
  const changed = nextHash !== current.contentHash;
  const status = event.status === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT';
  let nextStatus = current.status;
  if (changed) {
    nextStatus = status;
  } else if (status === 'SUBMITTED' && current.status === 'DRAFT') {
    nextStatus = 'SUBMITTED';
  }
  const now = db.serverDate();
  const data = {
    ...form,
    status: nextStatus,
    contentHash: nextHash,
    contentVersion: changed ? current.contentVersion + 1 : current.contentVersion,
    updatedAt: now,
    submittedAt: status === 'SUBMITTED' ? current.submittedAt || now : current.submittedAt,
  };

  await db.collection('submissions').doc(current._id).update({ data });
  const updated = await db.collection('submissions').doc(current._id).get();
  return {
    submission: publicSubmission(updated.data),
  };
}

async function remove(db, openid, event) {
  const submission = await getOwnedSubmission(db, openid, event.id);
  await db.collection('submissions').doc(submission._id).update({
    data: {
      status: 'DELETED',
      deletedAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  });
  return { deleted: true };
}

async function submitMine(db, openid, event) {
  const submission = await getOwnedSubmission(db, openid, event.id);
  const now = db.serverDate();
  await db.collection('submissions').doc(submission._id).update({
    data: {
      status: 'SUBMITTED',
      submittedAt: submission.submittedAt || now,
      updatedAt: now,
    },
  });
  const updated = await db.collection('submissions').doc(submission._id).get();
  return {
    submission: publicSubmission(updated.data),
  };
}

async function createShare(db, openid, event) {
  await ensureCollection(db, 'share_codes');
  const submission = await getOwnedSubmission(db, openid, event.id);
  const snapshot = normalizeForm(submission);

  let code = '';
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = createShareCode();
    const existing = await db.collection('share_codes').where({ code: candidate }).limit(1).get();
    if (!existing.data.length) {
      code = candidate;
      break;
    }
  }
  assert(code, 'INTERNAL_ERROR', '分享标识生成失败，请稍后重试。', true);

  const expiresAt = getShareExpiry();
  const now = db.serverDate();
  await db.collection('share_codes').add({
    data: {
      _openid: openid,
      code,
      sourceSubmissionId: submission._id,
      sourceContentVersion: submission.contentVersion || 1,
      sourceContentHash: submission.contentHash,
      snapshot,
      status: 'ACTIVE',
      importCount: 0,
      lastImportedAt: null,
      expiresAt,
      createdAt: now,
      updatedAt: now,
    },
  });

  return {
    share: {
      code,
      expiresAt: expiresAt.toISOString(),
      sourceName: snapshot.name,
      sourceContentVersion: submission.contentVersion || 1,
    },
  };
}

async function importShared(db, openid, event) {
  await ensureCollection(db, 'share_codes');
  const code = normalizeShareCode(event.code);
  const result = await db.collection('share_codes').where({ code }).limit(1).get();
  const share = result.data[0];
  assert(share && share.status === 'ACTIVE', 'NOT_FOUND', '分享标识不存在或已失效。');

  const expiresAt = toIso(share.expiresAt);
  assert(expiresAt && new Date(expiresAt).getTime() > Date.now(), 'NOT_FOUND', '分享标识已过期。');

  const form = normalizeForm(share.snapshot);
  const now = db.serverDate();
  const created = await db.collection('submissions').add({
    data: {
      _openid: openid,
      ...form,
      status: 'DRAFT',
      evaluationStatus: 'NOT_EVALUATED',
      contentVersion: 1,
      contentHash: contentHash(form),
      latestEvaluationId: null,
      latestEvaluation: null,
      createdAt: now,
      updatedAt: now,
      submittedAt: null,
      deletedAt: null,
    },
  });

  await db.collection('share_codes').doc(share._id).update({
    data: {
      importCount: db.command.inc(1),
      lastImportedAt: now,
      updatedAt: now,
    },
  });

  const createdResult = await db.collection('submissions').doc(created._id).get();
  return {
    submission: publicSubmission(createdResult.data),
    source: {
      name: form.name,
      contentVersion: share.sourceContentVersion || 1,
    },
  };
}

async function dashboard(db, openid) {
  const base = {
    _openid: openid,
    deletedAt: null,
  };
  const collection = db.collection('submissions');
  const [total, drafts, submitted, evaluating, evaluated] = await Promise.all([
    collection.where(base).count(),
    collection.where({ ...base, status: 'DRAFT' }).count(),
    collection.where({ ...base, status: 'SUBMITTED' }).count(),
    collection.where({
      ...base,
      evaluationStatus: db.command.in(['QUEUED', 'RUNNING', 'RETRYING']),
    }).count(),
    collection.where({ ...base, evaluationStatus: 'SUCCEEDED' }).count(),
  ]);
  return {
    total: total.total,
    drafts: drafts.total,
    submitted: submitted.total,
    evaluating: evaluating.total,
    evaluated: evaluated.total,
  };
}

module.exports = {
  create,
  createShare,
  dashboard,
  getMine,
  importShared,
  listMine,
  remove,
  submitMine,
  update,
};
