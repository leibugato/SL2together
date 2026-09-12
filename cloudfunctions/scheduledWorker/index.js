const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const command = db.command;

exports.main = async () => {
  const requestId = `worker_${Date.now().toString(36)}`;
  const internalToken = process.env.INTERNAL_TASK_TOKEN;
  if (!internalToken) {
    return {
      ok: true,
      data: {
        skipped: true,
        reason: 'INTERNAL_TASK_TOKEN 未配置。',
      },
      requestId,
    };
  }

  const threshold = new Date(Date.now() - 30 * 1000);
  const result = await db
    .collection('evaluation_jobs')
    .where({
      status: command.in(['QUEUED', 'RETRYING']),
      createdAt: command.lt(threshold),
    })
    .orderBy('createdAt', 'asc')
    .limit(5)
    .get();

  const jobs = result.data || [];
  const outcomes = [];
  for (const job of jobs) {
    try {
      const response = await cloud.callFunction({
        name: 'evaluationRunner',
        data: {
          jobId: job._id,
          internalToken,
        },
      });
      outcomes.push({
        jobId: job._id,
        ok: Boolean(response.result?.ok),
      });
    } catch (error) {
      outcomes.push({
        jobId: job._id,
        ok: false,
        message: error.message,
      });
    }
  }

  return {
    ok: true,
    data: {
      processed: outcomes.length,
      outcomes,
    },
    requestId,
  };
};

