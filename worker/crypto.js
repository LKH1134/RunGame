// 비밀번호 해싱과 세션 서명. Workers의 WebCrypto만 사용한다 (의존성 없음).

const PBKDF2_ITERATIONS = 100_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

const encoder = new TextEncoder();

// ── 비밀번호 ────────────────────────────────────────────────

/**
 * @param {string} password
 * @param {string} [saltB64] 검증할 때는 기존 salt를 넘긴다. 없으면 새로 만든다.
 */
export async function hashPassword(password, saltB64) {
  const salt = saltB64
    ? base64ToBytes(saltB64)
    : crypto.getRandomValues(new Uint8Array(SALT_BYTES));

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );

  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    KEY_BYTES * 8
  );

  return {
    hash: bytesToBase64(new Uint8Array(bits)),
    salt: bytesToBase64(salt),
  };
}

export async function verifyPassword(password, expectedHash, saltB64) {
  const { hash } = await hashPassword(password, saltB64);
  return timingSafeEqual(hash, expectedHash);
}

// ── 세션 토큰 ───────────────────────────────────────────────
//
// 서버에 세션 테이블을 두지 않는다. 토큰 자체가 "누구인지 + 언제까지"를
// 담고, HMAC 서명으로 위조를 막는다. 이러면 D1 조회 한 번이 줄고
// Worker가 상태를 갖지 않아 어느 엣지에서 처리되든 동일하게 동작한다.

export async function createSessionToken(userId, secret, ttlSeconds) {
  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${userId}.${expiresAt}`;
  const signature = await hmac(payload, secret);
  return `${bytesToBase64Url(encoder.encode(payload))}.${signature}`;
}

/** @returns {Promise<number|null>} 유효하면 userId, 아니면 null */
export async function readSessionToken(token, secret) {
  const dot = token.lastIndexOf('.');
  if (dot <= 0) return null;

  const payloadPart = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  let payload;
  try {
    payload = new TextDecoder().decode(base64UrlToBytes(payloadPart));
  } catch {
    return null;
  }

  const expected = await hmac(payload, secret);
  if (!timingSafeEqual(signature, expected)) return null;

  const [userId, expiresAt] = payload.split('.');
  if (!userId || !expiresAt) return null;
  if (Number(expiresAt) < Math.floor(Date.now() / 1000)) return null;

  const id = Number(userId);
  return Number.isInteger(id) ? id : null;
}

async function hmac(message, secret) {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return bytesToBase64Url(new Uint8Array(sig));
}

// ── 유틸 ────────────────────────────────────────────────────

/** 길이·내용 모두 상수 시간으로 비교한다 (해시 비교에서 타이밍 누출 방지). */
function timingSafeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function bytesToBase64(bytes) {
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function base64ToBytes(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64Url(bytes) {
  return bytesToBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url) {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  return base64ToBytes(padded);
}
