const crypto = require('crypto');
const {
  AppError,
  MOD_SPEC_VERSION,
  assert,
  getCatalogVersion,
  getMaxDailyEvaluations,
  getOwnedSubmission,
  getPromptVersion,
  getTodayKey,
  publicEvaluation,
  publicJob,
  publicSubmission,
} = require('./core');

function usageDocId(openid, date) {
  return crypto.createHash('sha256').update(`${openid}:${date}`).digest('hex');
}

const STALE_RUNNING_JOB_MS = 2 * 60 * 1000;

function isStaleRunningJob(job) {
  if (job.status !== 'RUNNING') return false;
  const updatedAt = new Date(job.updatedAt || job.lockedAt || job.createdAt).getTime();
  return Number.isFinite(updatedAt) && Date.now() - updatedAt > STALE_RUNNING_JOB_MS;
}

async function getUserUsage(db, openid, date) {
  try {
    const result = await db.collection('usage_daily').doc(usageDocId(openid, date)).get();
    return result.data || null;
  } catch (error) {
    return null;
  }
}

async function incrementUsage(db, openid, date) {
  const id = usageDocId(openid, date);
  const usage = await getUserUsage(db, openid, date);
  if (!usage) {
    await db.collection('usage_daily').doc(id).set({
      data: {
        _openid: openid,
        date,
        evaluationCount: 1,
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    });
    return;
  }
  await db.collection('usage_daily').doc(usage._id).update({
    data: {
      evaluationCount: db.command.inc(1),
      updatedAt: db.serverDate(),
    },
  });
}

async function start(db, openid, event) {
  const submission = await getOwnedSubmission(db, openid, event.submissionId);
  assert(submission.designText && submission.designText.length >= 15, 'VALIDATION_ERROR', '设计信息不完整，无法评估。');

  const catalogVersion = getCatalogVersion();
  const promptVersion = getPromptVersion();
  const provider = process.env.AI_PROVIDER || 'mock';
  const model = process.env.AI_MODEL || 'mock-v1';

  const cachedResult = await db
    .collection('evaluations')
    .where({
      submissionId: submission._id,
    })
    .limit(30)
    .get();
  const cached = cachedResult.data.find(
    (item) =>
      item._openid === openid &&
      item.contentHash === submission.contentHash &&
      item.model?.provider === provider &&
      item.model?.catalogVersion === catalogVersion &&
      item.model?.promptVersion === promptVersion &&
      item.model?.model === model &&
      item.modGeneration?.version === MOD_SPEC_VERSION,
  );
  if (cached) {
    await db.collection('submissions').doc(submission._id).update({
      data: {
        evaluationStatus: 'SUCCEEDED',
        latestEvaluationId: cached._id,
        latestEvaluation: db.command.set({
          _id: cached._id,
          difficulty: cached.difficulty,
          summary: cached.summary,
          createdAt: cached.createdAt,
        }),
        updatedAt: db.serverDate(),
      },
    });
    return {
      cached: true,
      job: null,
      evaluation: publicEvaluation(cached),
      catalogVersion,
    };
  }

  const activeResult = await db
    .collection('evaluation_jobs')
    .where({
      submissionId: submission._id,
    })
    .limit(30)
    .get();
  const activeJob = activeResult.data.find(
    (item) =>
      item._openid === openid &&
      item.contentHash === submission.contentHash &&
      item.provider === provider &&
      item.model === model &&
      item.catalogVersion === catalogVersion &&
      item.promptVersion === promptVersion &&
      ['QUEUED', 'RUNNING', 'RETRYING'].includes(item.status) &&
      !isStaleRunningJob(item),
  );
  if (activeJob) {
    return {
      cached: false,
      job: publicJob(activeJob),
      evaluation: null,
      catalogVersion,
    };
  }

  const date = getTodayKey();
  const usage = await getUserUsage(db, openid, date);
  if ((usage?.evaluationCount || 0) >= getMaxDailyEvaluations()) {
    throw new AppError('RATE_LIMITED', '今日评估次数已用完，请明天再试。');
  }

  const addResult = await db.collection('evaluation_jobs').add({
    data: {
      _openid: openid,
      submissionId: submission._id,
      contentVersion: submission.contentVersion,
      contentHash: submission.contentHash,
      status: 'QUEUED',
      mode: event.mode === 'deep' ? 'deep' : 'quick',
      attempts: 0,
      maxAttempts: 3,
      provider,
      model,
      catalogVersion,
      promptVersion,
      lockedAt: null,
      errorCode: null,
      errorMessage: null,
      createdAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  });
  await incrementUsage(db, openid, date);
  await db.collection('submissions').doc(submission._id).update({
    data: {
      evaluationStatus: 'QUEUED',
      updatedAt: db.serverDate(),
    },
  });

  const jobResult = await db.collection('evaluation_jobs').doc(addResult._id).get();
  return {
    cached: false,
    job: publicJob(jobResult.data),
    evaluation: null,
    catalogVersion,
  };
}

async function get(db, openid, event) {
  let job = null;
  let evaluation = null;

  if (event.jobId) {
    try {
      const result = await db.collection('evaluation_jobs').doc(event.jobId).get();
      if (result.data?._openid === openid) job = result.data;
    } catch (error) {
      job = null;
    }
  }

  if (event.evaluationId) {
    try {
      const result = await db.collection('evaluations').doc(event.evaluationId).get();
      if (result.data?._openid === openid) evaluation = result.data;
    } catch (error) {
      evaluation = null;
    }
  }

  const submissionId = event.submissionId || job?.submissionId;
  let submission = null;
  if (submissionId) {
    submission = await getOwnedSubmission(db, openid, submissionId);
    if (!evaluation) {
      if (submission.latestEvaluationId) {
        try {
          const result = await db.collection('evaluations').doc(submission.latestEvaluationId).get();
          if (result.data?._openid === openid) evaluation = result.data;
        } catch (error) {
          evaluation = null;
        }
      }
      if (!evaluation) {
        const result = await db
          .collection('evaluations')
          .where({
            submissionId,
          })
          .limit(30)
          .get();
        evaluation =
          result.data
            .filter((item) => item._openid === openid)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ||
          null;
      }
    }
    if (!job) {
      const result = await db
        .collection('evaluation_jobs')
        .where({
          submissionId,
        })
        .limit(30)
        .get();
      job =
        result.data
          .filter((item) => item._openid === openid)
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ||
        null;
    }
  }

  return {
    job: publicJob(job),
    evaluation: publicEvaluation(evaluation),
    submission: submission ? publicSubmission(submission) : null,
  };
}

async function retry(db, openid, event) {
  assert(event.jobId, 'VALIDATION_ERROR', '缺少任务 ID。');
  let job;
  try {
    const result = await db.collection('evaluation_jobs').doc(event.jobId).get();
    job = result.data;
  } catch (error) {
    throw new AppError('NOT_FOUND', '评估任务不存在。');
  }
  if (!job || job._openid !== openid) {
    throw new AppError('NOT_FOUND', '评估任务不存在。');
  }
  assert(job.status === 'FAILED', 'CONFLICT', '只有失败的评估任务可以重试。');
  assert((job.attempts || 0) < (job.maxAttempts || 3), 'RATE_LIMITED', '该任务已达到最大重试次数。');
  await db.collection('evaluation_jobs').doc(job._id).update({
    data: {
      status: 'QUEUED',
      errorCode: null,
      errorMessage: null,
      updatedAt: db.serverDate(),
    },
  });
  await db.collection('submissions').doc(job.submissionId).update({
    data: {
      evaluationStatus: 'QUEUED',
      updatedAt: db.serverDate(),
    },
  });
  const updated = await db.collection('evaluation_jobs').doc(job._id).get();
  return { job: publicJob(updated.data) };
}

module.exports = {
  get,
  retry,
  start,
};
