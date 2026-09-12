const crypto = require('crypto');
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const command = db.command;

const ROLE_LEVEL = {
  VIEWER: 1,
  MODERATOR: 2,
  SUPER_ADMIN: 3,
};

class AppError extends Error {
  constructor(code, message, retryable = false) {
    super(message);
    this.code = code;
    this.retryable = retryable;
  }
}

function createRequestId() {
  return `admin_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function success(data, requestId) {
  return { ok: true, data, requestId };
}

function failure(error, requestId) {
  const known = error instanceof AppError;
  return {
    ok: false,
    error: {
      code: known ? error.code : 'INTERNAL_ERROR',
      message: known ? error.message : '管理接口暂时不可用。',
      retryable: known ? error.retryable : false,
    },
    requestId,
  };
}

function toIso(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value.$date) return new Date(value.$date).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function maskOpenId(openid) {
  if (!openid) return '--';
  if (openid.length <= 8) return openid;
  return `${openid.slice(0, 4)}...${openid.slice(-4)}`;
}

function sanitizeEvaluation(evaluation) {
  if (!evaluation) return null;
  const { _openid, ...safe } = evaluation;
  return safe;
}

async function getAdmin(openid) {
  let result;
  try {
    result = await db
      .collection('admins')
      .where({
        _openid: openid,
      })
      .limit(1)
      .get();
  } catch (error) {
    return null;
  }
  const admin = result.data[0];
  if (!admin || admin.status !== 'ACTIVE' || !ROLE_LEVEL[admin.role]) {
    return null;
  }
  return admin;
}

async function requireAdmin(openid, minimumRole = 'VIEWER') {
  const admin = await getAdmin(openid);
  if (!admin) {
    throw new AppError('FORBIDDEN', '当前账号没有管理权限。');
  }
  if (ROLE_LEVEL[admin.role] < ROLE_LEVEL[minimumRole]) {
    throw new AppError('FORBIDDEN', '当前管理角色不能执行此操作。');
  }
  return admin;
}

async function loadUsers(openids) {
  const unique = [...new Set(openids.filter(Boolean))];
  const users = [];
  for (let index = 0; index < unique.length; index += 20) {
    const chunk = unique.slice(index, index + 20);
    const result = await db
      .collection('users')
      .where({
        _openid: command.in(chunk),
      })
      .limit(100)
      .get();
    users.push(...result.data);
  }
  return new Map(users.map((user) => [user._openid, user]));
}

async function loadLatestEvaluations(submissionIds) {
  const unique = [...new Set(submissionIds.filter(Boolean))];
  const evaluations = [];
  for (let index = 0; index < unique.length; index += 20) {
    const chunk = unique.slice(index, index + 20);
    const result = await db
      .collection('evaluations')
      .where({
        submissionId: command.in(chunk),
      })
      .limit(100)
      .get();
    evaluations.push(...result.data);
  }
  const latest = new Map();
  for (const evaluation of evaluations) {
    const current = latest.get(evaluation.submissionId);
    const currentTime = current ? new Date(current.createdAt).getTime() : 0;
    const nextTime = new Date(evaluation.createdAt).getTime();
    if (!current || nextTime > currentTime) {
      latest.set(evaluation.submissionId, evaluation);
    }
  }
  return latest;
}

function sanitizeExportRecord(submission, user, evaluation) {
  return {
    id: submission._id,
    ownerRef: user?._id || '',
    ownerLabel: maskOpenId(submission._openid),
    type: submission.type,
    name: submission.name,
    designText: submission.designText,
    resourceUrl: submission.resourceUrl || '',
    extra: submission.extra || {},
    status: submission.status,
    evaluationStatus: submission.evaluationStatus,
    contentVersion: submission.contentVersion || 1,
    contentHash: submission.contentHash,
    createdAt: toIso(submission.createdAt),
    updatedAt: toIso(submission.updatedAt),
    submittedAt: toIso(submission.submittedAt),
    deletedAt: toIso(submission.deletedAt),
    latestEvaluation: sanitizeEvaluation(evaluation),
  };
}

async function listSubmissions(openid, event) {
  await requireAdmin(openid, 'VIEWER');
  let ownerOpenId = '';
  if (event.userRef) {
    let user;
    try {
      const result = await db.collection('users').doc(event.userRef).get();
      user = result.data;
    } catch (error) {
      user = null;
    }
    if (!user) {
      return { items: [], total: 0 };
    }
    ownerOpenId = user._openid;
  }

  const result = await db.collection('submissions').limit(100).get();
  const items = [...result.data]
    .filter((item) => {
      if (item.deletedAt) return false;
      if (event.type && item.type !== event.type) return false;
      if (event.status && item.status !== event.status) return false;
      if (ownerOpenId && item._openid !== ownerOpenId) return false;
      return true;
    })
    .sort((left, right) => {
      const leftTime = new Date(left.updatedAt).getTime();
      const rightTime = new Date(right.updatedAt).getTime();
      return rightTime - leftTime;
    })
    .slice(0, 50);
  const users = await loadUsers(items.map((item) => item._openid));
  return {
    items: items.map((item) => ({
      _id: item._id,
      ownerRef: users.get(item._openid)?._id || '',
      ownerLabel: maskOpenId(item._openid),
      type: item.type,
      name: item.name,
      status: item.status,
      evaluationStatus: item.evaluationStatus,
      contentVersion: item.contentVersion || 1,
      updatedAt: toIso(item.updatedAt),
      latestDifficulty: item.latestEvaluation?.difficulty || null,
    })),
    total: items.length,
  };
}

async function selectSubmissionsForExport(event) {
  const selectedIds = Array.isArray(event.submissionIds)
    ? [...new Set(event.submissionIds.filter((item) => typeof item === 'string'))].slice(0, 200)
    : [];
  if (selectedIds.length) {
    const items = [];
    for (let index = 0; index < selectedIds.length; index += 20) {
      const chunk = selectedIds.slice(index, index + 20);
      const result = await db
        .collection('submissions')
        .where({
          _id: command.in(chunk),
        })
        .limit(100)
        .get();
      items.push(...result.data);
    }
    return items.filter((item) => event.includeDeleted || !item.deletedAt);
  }

  let ownerOpenId = '';
  if (event.userRef) {
    let user;
    try {
      const result = await db.collection('users').doc(event.userRef).get();
      user = result.data;
    } catch (error) {
      user = null;
    }
    if (!user) return [];
    ownerOpenId = user._openid;
  }

  const limit = Math.min(500, Math.max(1, Number(event.limit || 200)));
  const source = [];
  for (let offset = 0; offset < 1000; offset += 100) {
    const result = await db.collection('submissions').skip(offset).limit(100).get();
    source.push(...result.data);
    if (result.data.length < 100) break;
  }
  const startAt = event.startAt ? new Date(event.startAt).getTime() : null;
  const endAt = event.endAt ? new Date(event.endAt).getTime() : null;
  return source
    .filter((item) => {
      if (!event.includeDeleted && item.deletedAt) return false;
      if (event.type && item.type !== event.type) return false;
      if (event.status && item.status !== event.status) return false;
      if (ownerOpenId && item._openid !== ownerOpenId) return false;
      const time = new Date(item.createdAt).getTime();
      if (startAt !== null && Number.isFinite(startAt) && time < startAt) return false;
      if (endAt !== null && Number.isFinite(endAt) && time >= endAt) return false;
      return true;
    })
    .slice(0, limit);
}

async function exportSubmissions(openid, event) {
  const admin = await requireAdmin(openid, 'MODERATOR');
  const submissions = await selectSubmissionsForExport(event);
  if (!submissions.length) {
    throw new AppError('NOT_FOUND', '当前筛选条件下没有可导出的记录。');
  }
  const users = await loadUsers(submissions.map((item) => item._openid));
  const evaluations = await loadLatestEvaluations(
    submissions.map((item) => item._id),
  );
  const records = submissions.map((item) =>
    sanitizeExportRecord(item, users.get(item._openid), evaluations.get(item._id)),
  );
  const payload = {
    exportedAt: new Date().toISOString(),
    exportedByRole: admin.role,
    filters: {
      type: event.type || '',
      status: event.status || '',
      userRef: event.userRef || '',
      startAt: event.startAt || '',
      endAt: event.endAt || '',
      selectedOnly: Array.isArray(event.submissionIds) && event.submissionIds.length > 0,
    },
    count: records.length,
    submissions: records,
  };
  const buffer = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  const now = new Date();
  const day = now.toISOString().slice(0, 10);
  const fileName = `submissions-${Date.now()}-${crypto.randomBytes(3).toString('hex')}.json`;
  const cloudPath = `admin-exports/${day}/${fileName}`;
  const upload = await cloud.uploadFile({
    cloudPath,
    fileContent: buffer,
  });

  await db.collection('admin_audit_logs').add({
    data: {
      _openid: openid,
      action: 'EXPORT_SUBMISSIONS',
      targetId: cloudPath,
      result: 'SUCCESS',
      count: records.length,
      filters: payload.filters,
      createdAt: db.serverDate(),
    },
  });

  return {
    fileID: upload.fileID,
    fileName,
    count: records.length,
  };
}

async function dispatch(event, openid) {
  switch (event.action) {
    case 'admin.me': {
      const admin = await getAdmin(openid);
      return {
        isAdmin: Boolean(admin),
        role: admin?.role || null,
        canExport: Boolean(admin && ROLE_LEVEL[admin.role] >= ROLE_LEVEL.MODERATOR),
      };
    }
    case 'admin.listSubmissions':
      return listSubmissions(openid, event);
    case 'admin.exportSubmissions':
      return exportSubmissions(openid, event);
    default:
      throw new AppError('NOT_FOUND', '未知管理动作。');
  }
}

exports.main = async (event = {}) => {
  const requestId = createRequestId();
  try {
    const wxContext = cloud.getWXContext();
    const openid = wxContext.OPENID;
    if (!openid) {
      throw new AppError('UNAUTHENTICATED', '无法识别当前微信用户。');
    }
    const data = await dispatch(event, openid);
    return success(data, requestId);
  } catch (error) {
    console.error('admin_api_error', {
      requestId,
      action: event.action,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message,
    });
    return failure(error, requestId);
  }
};
