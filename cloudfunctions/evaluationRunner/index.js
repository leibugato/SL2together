const cloud = require('wx-server-sdk');
const crypto = require('crypto');
const { AppError } = require('./lib/errors');
const { retrieveKnowledge } = require('./lib/knowledge');
const { analyze } = require('./lib/rules');
const provider = require('./lib/provider');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const command = db.command;

function createRequestId() {
  return `eval_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function createOwnerTag(openid) {
  return crypto.createHash('sha256').update(String(openid || '')).digest('hex').slice(0, 8).toUpperCase();
}

function success(data, requestId) {
  return { ok: true, data, requestId };
}

function failure(error, requestId) {
  const known = error instanceof AppError;
  const isDevelopment = process.env.APP_ENV !== 'prod';
  return {
    ok: false,
    error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known
        ? error.message
        : isDevelopment
          ? `评估调试错误：${error?.message || '未知错误'}`
          : '评估失败，请稍后重试。',
      retryable: known ? error.retryable : true,
    },
    requestId,
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

function publicEvaluation(evaluation) {
  if (!evaluation) return null;
  const { _openid, ...safeEvaluation } = evaluation;
  return safeEvaluation;
}

const STALE_RUNNING_JOB_MS = 2 * 60 * 1000;

function isStaleRunningJob(job) {
  if (job.status !== 'RUNNING') return false;
  const updatedAt = new Date(job.updatedAt || job.lockedAt || job.createdAt).getTime();
  return Number.isFinite(updatedAt) && Date.now() - updatedAt > STALE_RUNNING_JOB_MS;
}

async function getSubmission(job) {
  const result = await db.collection('submissions').doc(job.submissionId).get();
  if (!result.data || result.data.deletedAt) {
    throw new AppError('NOT_FOUND', '设计记录不存在。');
  }
  return result.data;
}

async function updateSubmissionIfCurrent(job, data) {
  let current;
  try {
    const result = await db.collection('submissions').doc(job.submissionId).get();
    current = result.data;
  } catch (error) {
    return false;
  }
  if (
    !current ||
    current._openid !== job._openid ||
    current.deletedAt ||
    current.contentHash !== job.contentHash
  ) {
    return false;
  }
  await db.collection('submissions').doc(job.submissionId).update({
    data: {
      ...data,
      updatedAt: db.serverDate(),
    },
  });
  return true;
}

async function runJob(jobId, callerOpenid, systemAccess) {
  let job;
  try {
    const result = await db.collection('evaluation_jobs').doc(jobId).get();
    job = result.data;
  } catch (error) {
    throw new AppError('NOT_FOUND', '评估任务不存在。');
  }

  if (!job || (!systemAccess && job._openid !== callerOpenid)) {
    throw new AppError('NOT_FOUND', '评估任务不存在。');
  }

  if (job.status === 'SUCCEEDED' && job.evaluationId) {
    const evaluationResult = await db.collection('evaluations').doc(job.evaluationId).get();
    return { evaluation: publicEvaluation(evaluationResult.data), cached: true };
  }

  if (job.status === 'RUNNING' && !isStaleRunningJob(job)) {
    return { job: publicJob(job), cached: false };
  }

  if (job.status === 'RUNNING') {
    await db.collection('evaluation_jobs').doc(jobId).update({
      data: {
        status: 'QUEUED',
        lockedAt: null,
        updatedAt: db.serverDate(),
      },
    });
    job = {
      ...job,
      status: 'QUEUED',
      lockedAt: null,
    };
  }

  if (!['QUEUED', 'RETRYING'].includes(job.status)) {
    return { job: publicJob(job), cached: false };
  }

  await db.collection('evaluation_jobs').doc(jobId).update({
    data: {
      status: 'RUNNING',
      attempts: command.inc(1),
      lockedAt: db.serverDate(),
      updatedAt: db.serverDate(),
    },
  });

  const runningJob = {
    ...job,
    status: 'RUNNING',
    attempts: (job.attempts || 0) + 1,
  };

  try {
    const submission = await getSubmission(runningJob);
    await updateSubmissionIfCurrent(runningJob, {
      evaluationStatus: 'RUNNING',
    });
    const ruleResult = analyze({
      ...submission,
      ownerTag: createOwnerTag(runningJob._openid),
    });
    const knowledgeSnippets = retrieveKnowledge(submission, ruleResult);
    const generated = await provider.evaluate({
      submission: {
        type: submission.type,
        name: submission.name,
        designText: submission.designText,
        resourceUrl: submission.resourceUrl || '',
        extra: submission.extra || {},
      },
      ruleResult,
      catalogVersion: runningJob.catalogVersion,
      knowledgeSnippets,
    });

    const evaluationResult = generated.result;
    const addResult = await db.collection('evaluations').add({
      data: {
        _openid: runningJob._openid,
        submissionId: runningJob.submissionId,
        contentVersion: runningJob.contentVersion,
        contentHash: runningJob.contentHash,
        ...evaluationResult,
        model: {
          provider: generated.provider,
          model: generated.model,
          promptVersion: runningJob.promptVersion,
          catalogVersion: runningJob.catalogVersion,
          knowledgeSnippetIds: knowledgeSnippets.map((item) => item.id),
        },
        createdAt: db.serverDate(),
      },
    });

    const createdEvaluation = await db.collection('evaluations').doc(addResult._id).get();
    await db.collection('evaluation_jobs').doc(jobId).update({
      data: {
        status: 'SUCCEEDED',
        evaluationId: addResult._id,
        errorCode: null,
        errorMessage: null,
        updatedAt: db.serverDate(),
      },
    });

    await updateSubmissionIfCurrent(runningJob, {
      evaluationStatus: 'SUCCEEDED',
      latestEvaluationId: addResult._id,
      latestEvaluation: command.set({
        _id: addResult._id,
        difficulty: evaluationResult.difficulty,
        summary: evaluationResult.summary,
        createdAt: createdEvaluation.data.createdAt,
      }),
    });

    return {
      evaluation: publicEvaluation(createdEvaluation.data),
      cached: false,
    };
  } catch (error) {
    const attempts = runningJob.attempts;
    const maxAttempts = runningJob.maxAttempts || 3;
    const retryable = error instanceof AppError ? error.retryable : true;
    const nextStatus = retryable && attempts < maxAttempts ? 'RETRYING' : 'FAILED';
    await db.collection('evaluation_jobs').doc(jobId).update({
      data: {
        status: nextStatus,
        errorCode: error.code || 'AI_PROVIDER_ERROR',
        errorMessage: String(error.message || '评估失败').slice(0, 300),
        updatedAt: db.serverDate(),
      },
    });
    await updateSubmissionIfCurrent(runningJob, {
      evaluationStatus: nextStatus === 'FAILED' ? 'FAILED' : 'RETRYING',
    });
    throw error;
  }
}

exports.main = async (event = {}) => {
  const requestId = createRequestId();
  try {
    if (!event.jobId) {
      throw new AppError('VALIDATION_ERROR', '缺少任务 ID。');
    }
    const token = process.env.INTERNAL_TASK_TOKEN;
    const systemAccess = Boolean(token && event.internalToken === token);
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID || '';
    if (!systemAccess && !openid) {
      throw new AppError('UNAUTHENTICATED', '无法识别当前微信用户。');
    }
    const data = await runJob(event.jobId, openid, systemAccess);
    return success(data, requestId);
  } catch (error) {
    console.error('evaluation_error', {
      requestId,
      jobId: event.jobId,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message,
    });
    return failure(error, requestId);
  }
};
