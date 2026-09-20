const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceRoots = ['miniprogram', 'cloudfunctions', 'mod-builder/sl2modgen', 'scripts'];
const sourceExtensions = new Set(['.js', '.ts', '.py', '.json']);
const requiredCloudFunctions = [
  'api',
  'adminApi',
  'evaluationRunner',
  'scheduledWorker',
  'systemInit',
];
const secretPatterns = [
  /\bsk-[A-Za-z0-9._-]{16,}\b/,
  /AI_API_KEY\s*[:=]\s*["'][^"']{8,}["']/,
  /MOD_BUILD_TOKEN\s*[:=]\s*["'][^"']{8,}["']/,
  /INIT_SECRET\s*[:=]\s*["'][^"']{8,}["']/,
];

const checks = [];

function pass(message) {
  checks.push({ level: 'PASS', message });
}

function warn(message) {
  checks.push({ level: 'WARN', message });
}

function fail(message) {
  checks.push({ level: 'FAIL', message });
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function walk(directory) {
  const fullPath = path.join(root, directory);
  if (!fs.existsSync(fullPath)) return [];
  return fs.readdirSync(fullPath, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', '.git', 'dist', 'build', '.tmp'].includes(entry.name)) return [];
      return walk(relativePath);
    }
    return [relativePath];
  });
}

function checkProjectConfig() {
  const config = readJson('project.config.json');
  if (/^wx[0-9a-f]{16}$/i.test(String(config.appid || ''))) {
    pass(`AppID 已配置：${config.appid}`);
  } else {
    fail('project.config.json 的 appid 未配置为有效微信小程序 AppID。');
  }
  if (config.setting?.urlCheck === true && config.setting?.minified === true) {
    pass('小程序上传配置已开启 URL 校验和代码压缩。');
  } else {
    fail('请开启 project.config.json 的 urlCheck 和 minified。');
  }
}

function checkCloudEnvironment() {
  const envSource = fs.readFileSync(path.join(root, 'miniprogram/config/env.ts'), 'utf8');
  const match = envSource.match(/ENV_ID\s*=\s*['"]([^'"]+)['"]/);
  const envId = match?.[1] || '';
  if (!envId || /你的|example|placeholder/i.test(envId)) {
    fail('miniprogram/config/env.ts 尚未填写正式云环境 ID。');
  } else {
    pass(`云环境 ID 已配置：${envId}`);
  }
  const expected = process.env.EXPECTED_PROD_ENV_ID;
  if (expected && expected !== envId) {
    fail(`当前云环境与 EXPECTED_PROD_ENV_ID 不一致：${envId}`);
  }
}

function checkCloudFunctions() {
  const missing = requiredCloudFunctions.filter(
    (name) => !fs.existsSync(path.join(root, 'cloudfunctions', name, 'index.js')),
  );
  if (missing.length) {
    fail(`缺少云函数：${missing.join('、')}`);
  } else {
    pass(`核心云函数齐全：${requiredCloudFunctions.join('、')}`);
  }
}

function checkReleaseDocs() {
  const required = [
    'docs/formal-release-checklist.md',
    'docs/database-schema.md',
    'docs/admin-data-export.md',
    'docs/cloud-development-setup.md',
  ];
  const missing = required.filter((relativePath) => !fs.existsSync(path.join(root, relativePath)));
  if (missing.length) {
    fail(`缺少发布文档：${missing.join('、')}`);
  } else {
    pass('正式版发布、数据库和管理员文档齐全。');
  }
}

function checkSecrets() {
  const violations = [];
  for (const relativePath of sourceRoots.flatMap(walk)) {
    if (!sourceExtensions.has(path.extname(relativePath))) continue;
    const content = fs.readFileSync(path.join(root, relativePath), 'utf8');
    for (const pattern of secretPatterns) {
      if (pattern.test(content)) {
        violations.push(relativePath);
        break;
      }
    }
  }
  if (violations.length) {
    fail(`源码中疑似存在明文密钥：${violations.join('、')}`);
  } else {
    pass('未发现常见的明文 API Key、构建 Token 或初始化密钥。');
  }
}

function checkManualEnvironmentFlags() {
  warn('发布前仍需在云函数控制台确认 APP_ENV=prod；脚本无法读取线上环境变量。');
  warn('发布前仍需在云开发控制台确认数据库权限、索引和云存储生命周期规则。');
  warn('发布前仍需在微信公众平台确认服务类目、隐私保护指引、备案和体验版验收。');
}

checkProjectConfig();
checkCloudEnvironment();
checkCloudFunctions();
checkReleaseDocs();
checkSecrets();
checkManualEnvironmentFlags();

for (const check of checks) {
  console.log(`[${check.level}] ${check.message}`);
}

if (checks.some((check) => check.level === 'FAIL')) {
  process.exitCode = 1;
} else {
  console.log('release-preflight: repository checks passed');
}
