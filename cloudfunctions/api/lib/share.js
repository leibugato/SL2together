const crypto = require('crypto');
const { assert } = require('./core');

const SHARE_CODE_PREFIX = 'SL2';
const SHARE_CODE_BODY_LENGTH = 16;
const SHARE_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const SHARE_CODE_TTL_MS = 90 * 24 * 60 * 60 * 1000;

function formatShareCode(body) {
  return [
    SHARE_CODE_PREFIX,
    body.slice(0, 4),
    body.slice(4, 8),
    body.slice(8, 12),
    body.slice(12, 16),
  ].join('-');
}

function createShareCode() {
  const bytes = crypto.randomBytes(SHARE_CODE_BODY_LENGTH);
  let body = '';
  for (const byte of bytes) {
    body += SHARE_CODE_ALPHABET[byte % SHARE_CODE_ALPHABET.length];
  }
  return formatShareCode(body);
}

function normalizeShareCode(value) {
  let raw = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');

  if (raw.length === SHARE_CODE_PREFIX.length + SHARE_CODE_BODY_LENGTH && raw.startsWith(SHARE_CODE_PREFIX)) {
    raw = raw.slice(SHARE_CODE_PREFIX.length);
  }

  assert(raw.length === SHARE_CODE_BODY_LENGTH, 'VALIDATION_ERROR', '请输入完整的分享标识。');
  assert(
    [...raw].every((character) => SHARE_CODE_ALPHABET.includes(character)),
    'VALIDATION_ERROR',
    '分享标识包含无效字符。',
  );
  return formatShareCode(raw);
}

function getShareExpiry(now = Date.now()) {
  return new Date(now + SHARE_CODE_TTL_MS);
}

module.exports = {
  SHARE_CODE_TTL_MS,
  createShareCode,
  getShareExpiry,
  normalizeShareCode,
};
