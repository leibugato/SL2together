const http = require('http');
const https = require('https');
const {
  AppError,
  assert,
  ensureCollection,
  getOwnedSubmission,
  publicEvaluation,
} = require('./core');

function requestJson(urlString, token, body, timeoutMs) {
  const url = new URL(urlString);
  const transport = url.protocol === 'http:' ? http : https;
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-mod-build-token': token,
          'content-length': Buffer.byteLength(payload),
        },
        timeout: timeoutMs,
      },
      (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          text += chunk;
          if (text.length > 30 * 1024 * 1024) {
            request.destroy(new Error('MOD builder response too large'));
          }
        });
        response.on('end', () => {
          let parsed = null;
          try {
            parsed = text ? JSON.parse(text) : null;
          } catch (error) {
            parsed = null;
          }
          if (response.statusCode < 200 || response.statusCode >= 300) {
            reject(
              new AppError(
                'MOD_BUILD_FAILED',
                parsed?.detail || `MOD 构建服务返回 HTTP ${response.statusCode}。`,
                response.statusCode >= 500,
              ),
            );
            return;
          }
          if (!parsed) {
            reject(new AppError('MOD_BUILD_FAILED', 'MOD 构建服务响应不是有效 JSON。', true));
            return;
          }
          resolve(parsed);
        });
      },
    );
    request.on('timeout', () => {
      request.destroy(new AppError('MOD_BUILD_TIMEOUT', 'MOD 构建超时，请稍后重试。', true));
    });
    request.on('error', (error) => {
      if (error instanceof AppError) {
        reject(error);
      } else {
        reject(new AppError('MOD_BUILD_FAILED', 'MOD 构建服务连接失败。', true));
      }
    });
    request.write(payload);
    request.end();
  });
}

function publicModJob(job) {
  if (!job) return null;
  let manifest = job.manifest || null;
  let testGuide = null;
  if (typeof job.manifestJson === 'string' && job.manifestJson.trim()) {
    try {
      manifest = JSON.parse(job.manifestJson);
    } catch (error) {
      manifest = null;
    }
  }
  if (typeof job.testGuideJson === 'string' && job.testGuideJson.trim()) {
    try {
      testGuide = JSON.parse(job.testGuideJson);
    } catch (error) {
      testGuide = null;
    }
  }
  return {
    _id: job._id,
    submissionId: job.submissionId,
    evaluationId: job.evaluationId,
    status: job.status,
    contentVersion: job.contentVersion,
    contentHash: job.contentHash,
    manifest,
    testGuide,
    modFileId: job.modFileId || '',
    sourceFileId: job.sourceFileId || '',
    modZipSize: job.modZipSize || 0,
    sourceZipSize: job.sourceZipSize || 0,
    errorCode: job.errorCode || null,
    errorMessage: job.errorMessage || null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

async function getEvaluationForSubmission(db, openid, submission) {
  if (submission.latestEvaluationId) {
    try {
      const result = await db.collection('evaluations').doc(submission.latestEvaluationId).get();
      if (
        result.data &&
        result.data._openid === openid &&
        result.data.contentHash === submission.contentHash
      ) {
        return result.data;
      }
    } catch (error) {
      // Fall through to a recent evaluation lookup.
    }
  }
  const result = await db
    .collection('evaluations')
    .where({ submissionId: submission._id })
    .limit(30)
    .get();
  return (
    result.data
      .filter(
        (item) => item._openid === openid && item.contentHash === submission.contentHash,
      )
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ||
    null
  );
}

async function createReferenceUrl(cloud, jobId) {
  const fileId = process.env.STS2_REFERENCE_FILE_ID || '';
  if (!fileId) {
    throw new AppError(
      'MOD_BUILDER_NOT_CONFIGURED',
      '尚未配置 STS2_REFERENCE_FILE_ID。',
      false,
    );
  }
  if (!fileId.startsWith('cloud://')) {
    throw new AppError(
      'MOD_BUILDER_NOT_CONFIGURED',
      'STS2_REFERENCE_FILE_ID 必须使用 cloud:// 格式，不能填写 HTTPS 链接。',
      false,
    );
  }
  const result = await cloud.getTempFileURL({ fileList: [fileId] });
  const item = result?.fileList?.[0];
  if (!item || (item.status !== undefined && Number(item.status) !== 0) || !item.tempFileURL) {
    console.error('reference_temp_url_error', { jobId, fileId, result });
    throw new AppError(
      'MOD_BUILDER_NOT_CONFIGURED',
      `引用包临时链接生成失败：${item?.errMsg || '请检查 fileID 是否属于当前云环境。'}`,
      false,
    );
  }
  return item.tempFileURL;
}

async function generate(db, cloud, openid, event) {
  await ensureCollection(db, 'mod_generation_jobs');
  const submission = await getOwnedSubmission(db, openid, event.submissionId);
  const evaluation = await getEvaluationForSubmission(db, openid, submission);
  assert(evaluation, 'VALIDATION_ERROR', '请先完成评估，再生成 MOD。');
  assert(
    evaluation.contentHash === submission.contentHash,
    'CONFLICT',
    '设计已修改，请重新评估后再生成 MOD。',
  );
  const modGeneration = evaluation.modGeneration || null;
  assert(modGeneration?.supported, 'VALIDATION_ERROR', modGeneration?.reason || '该设计不支持自动生成 MOD。');
  assert(modGeneration.spec, 'INTERNAL_ERROR', '评估结果缺少生成规格，请重新评估。');

  const builderUrl = process.env.MOD_BUILDER_URL || '';
  const builderToken = process.env.MOD_BUILD_TOKEN || '';
  assert(builderUrl && builderToken, 'MOD_BUILDER_NOT_CONFIGURED', 'MOD 构建服务尚未配置。');

  const now = db.serverDate();
  const created = await db.collection('mod_generation_jobs').add({
    data: {
      _openid: openid,
      submissionId: submission._id,
      evaluationId: evaluation._id,
      contentVersion: submission.contentVersion,
      contentHash: submission.contentHash,
      status: 'QUEUED',
      manifestJson: '',
      testGuideJson: '',
      modFileId: '',
      sourceFileId: '',
      modZipSize: 0,
      sourceZipSize: 0,
      errorCode: null,
      errorMessage: null,
      createdAt: now,
      updatedAt: now,
    },
  });
  const jobId = created._id;
  await db.collection('mod_generation_jobs').doc(jobId).update({
    data: {
      status: 'RUNNING',
      updatedAt: db.serverDate(),
    },
  });

  try {
    const referenceUrl = await createReferenceUrl(cloud, jobId);
    const built = await requestJson(
      builderUrl,
      builderToken,
      {
        jobId,
        referenceUrl,
        spec: modGeneration.spec,
      },
      Math.max(10000, Number(process.env.MOD_BUILDER_TIMEOUT_MS || 45000)),
    );
    assert(built.ok, 'MOD_BUILD_FAILED', 'MOD 构建失败。');
    assert(built.modZipBase64 && built.sourceZipBase64, 'MOD_BUILD_FAILED', '构建产物不完整。');

    const basePath = `mod-build/artifacts/${openid}/${jobId}`;
    const [modUpload, sourceUpload] = await Promise.all([
      cloud.uploadFile({
        cloudPath: `${basePath}/mod.zip`,
        fileContent: Buffer.from(built.modZipBase64, 'base64'),
      }),
      cloud.uploadFile({
        cloudPath: `${basePath}/source.zip`,
        fileContent: Buffer.from(built.sourceZipBase64, 'base64'),
      }),
    ]);

    await db.collection('mod_generation_jobs').doc(jobId).update({
      data: {
        status: 'SUCCEEDED',
        manifestJson: JSON.stringify(built.manifest || {}),
        testGuideJson: JSON.stringify(built.testGuide || {}),
        modFileId: modUpload.fileID,
        sourceFileId: sourceUpload.fileID,
        modZipSize: Number(built.modZipSize || 0),
        sourceZipSize: Number(built.sourceZipSize || 0),
        updatedAt: db.serverDate(),
      },
    });
    const result = await db.collection('mod_generation_jobs').doc(jobId).get();
    return {
      job: publicModJob(result.data),
      evaluation: publicEvaluation(evaluation),
    };
  } catch (error) {
    await db.collection('mod_generation_jobs').doc(jobId).update({
      data: {
        status: 'FAILED',
        errorCode: error.code || 'MOD_BUILD_FAILED',
        errorMessage: String(error.message || 'MOD 构建失败。').slice(0, 300),
        updatedAt: db.serverDate(),
      },
    });
    throw error;
  }
}

async function get(db, openid, event) {
  let job = null;
  if (event.jobId) {
    try {
      const result = await db.collection('mod_generation_jobs').doc(event.jobId).get();
      if (result.data?._openid === openid) job = result.data;
    } catch (error) {
      job = null;
    }
  } else if (event.submissionId) {
    await getOwnedSubmission(db, openid, event.submissionId);
    const result = await db
      .collection('mod_generation_jobs')
      .where({ submissionId: event.submissionId })
      .limit(30)
      .get();
    job =
      result.data
        .filter((item) => item._openid === openid)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ||
      null;
  } else {
    throw new AppError('VALIDATION_ERROR', '缺少生成任务 ID 或设计 ID。');
  }
  return { job: publicModJob(job) };
}

module.exports = {
  generate,
  get,
  publicModJob,
};
