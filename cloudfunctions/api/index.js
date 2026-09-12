const cloud = require('wx-server-sdk');
const {
  AppError,
  createRequestId,
  ensureCollection,
  failure,
  publicUser,
  success,
  toIso,
} = require('./lib/core');
const idea = require('./lib/idea');
const evaluation = require('./lib/evaluation');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();

async function bootstrapUser(openid) {
  await ensureCollection(db, 'users');
  const result = await db
    .collection('users')
    .where({
      _openid: openid,
    })
    .limit(1)
    .get();
  let user = result.data[0];
  if (!user) {
    const created = await db.collection('users').add({
      data: {
        _openid: openid,
        nickname: '',
        avatarUrl: '',
        status: 'active',
        createdAt: db.serverDate(),
        updatedAt: db.serverDate(),
        lastActiveAt: db.serverDate(),
      },
    });
    const createdResult = await db.collection('users').doc(created._id).get();
    user = createdResult.data;
  } else {
    await db.collection('users').doc(user._id).update({
      data: {
        lastActiveAt: db.serverDate(),
        updatedAt: db.serverDate(),
      },
    });
    user.lastActiveAt = new Date();
  }
  return {
    user: publicUser(user),
    openid,
  };
}

async function dispatch(event, openid) {
  switch (event.action) {
    case 'user.bootstrap':
      return bootstrapUser(openid);
    case 'idea.create':
      return idea.create(db, openid, event);
    case 'idea.update':
      return idea.update(db, openid, event);
    case 'idea.listMine':
      return idea.listMine(db, openid, event);
    case 'idea.getMine':
      return idea.getMine(db, openid, event);
    case 'idea.deleteMine':
      return idea.remove(db, openid, event);
    case 'idea.submitMine':
      return idea.submitMine(db, openid, event);
    case 'idea.dashboard':
      return idea.dashboard(db, openid);
    case 'evaluation.start':
      return evaluation.start(db, openid, event);
    case 'evaluation.get':
      return evaluation.get(db, openid, event);
    case 'evaluation.retry':
      return evaluation.retry(db, openid, event);
    case 'system.ping':
      return {
        service: 'api',
        env: process.env.APP_ENV || 'unknown',
        catalogVersion: process.env.CATALOG_VERSION || 'sts2-api-2026.09-r4',
        serverTime: toIso(new Date()),
      };
    default:
      throw new AppError('NOT_FOUND', '未知接口动作。');
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
    console.error('api_error', {
      requestId,
      action: event.action,
      code: error.code || 'INTERNAL_ERROR',
      message: error.message,
      stack: error.stack,
    });
    return failure(error, requestId);
  }
};
