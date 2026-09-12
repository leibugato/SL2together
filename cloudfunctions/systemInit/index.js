const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV,
});

const db = cloud.database();
const COLLECTIONS = [
  'users',
  'submissions',
  'evaluations',
  'evaluation_jobs',
  'catalog_versions',
  'usage_daily',
  'admins',
  'admin_audit_logs',
];

function isExisting(error) {
  const message = String(error && (error.errMsg || error.message || error));
  return /already exists|already exist|collection.*exist|集合.*存在/i.test(message);
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name);
    return { name, created: true };
  } catch (error) {
    if (isExisting(error)) {
      return { name, created: false };
    }
    throw error;
  }
}

exports.main = async (event = {}) => {
  const requestId = `init_${Date.now().toString(36)}`;
  try {
    const expectedSecret = process.env.INIT_SECRET || '';
    const isProduction = process.env.APP_ENV === 'prod';
    if ((isProduction || expectedSecret) && event.secret !== expectedSecret) {
      return {
        ok: false,
        error: {
          code: 'FORBIDDEN',
          message: '初始化密钥不正确。',
          retryable: false,
        },
        requestId,
      };
    }

    const collections = [];
    for (const name of COLLECTIONS) {
      collections.push(await ensureCollection(name));
    }

    const catalogVersion = process.env.CATALOG_VERSION || 'sts2-api-2026.09-r4';
    await db.collection('catalog_versions').doc(catalogVersion).set({
      data: {
        gameBuild: process.env.GAME_BUILD || 'unconfirmed',
        sourceType: 'curated_reference',
        summary:
          '包含 CardModel、RelicModel、EventModel、AncientEventModel、MonsterModel、PowerModel、命令、池、音频和打包规则。',
        status: 'ACTIVE',
        updatedAt: db.serverDate(),
      },
    });

    return {
      ok: true,
      data: {
        collections,
        catalogVersion,
      },
      requestId,
    };
  } catch (error) {
    console.error('system_init_error', {
      requestId,
      message: error.message,
      code: error.code || 'INTERNAL_ERROR',
    });
    return {
      ok: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: error.message || '初始化失败。',
        retryable: true,
      },
      requestId,
    };
  }
};
