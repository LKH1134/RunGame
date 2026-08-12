import { api, ApiError } from './client.js';

// 인증 상태는 Worker의 HttpOnly 세션 쿠키가 들고 있다.
// 클라이언트는 그 쿠키를 읽을 수 없으므로(그게 목적이다), 부팅 시
// /api/auth/me 로 한 번 물어보고 이후에는 메모리에서 관리한다.

const listeners = new Set();
let currentUser = null;
let restored = false;

/**
 * 아이디 규칙.
 * Firebase Auth를 쓸 때는 이메일 형식이라 영문·숫자·`._-` 로 묶여 있었지만,
 * 이제 직접 저장하므로 그 제약이 사라졌다. 한글 아이디도 쓸 수 있다.
 * 서버(worker/index.js)와 같은 규칙을 유지한다 — 여기는 즉시 피드백용이고
 * 실제 강제는 서버가 한다.
 */
export const ID_HINT = '공백 없이 2~20자. 한글·영문·숫자 모두 쓸 수 있어요';

export function validateId(id) {
  if (!id) return '아이디를 입력해 주세요.';
  if (id.trim() !== id) return '아이디 앞뒤에 공백을 쓸 수 없어요.';
  if (id.length < 2 || id.length > 20) return '아이디는 2~20자로 입력해 주세요.';
  if (/\s/.test(id)) return '아이디에 공백을 쓸 수 없어요.';
  return null;
}

export function validatePassword(pw) {
  if (!pw) return '비밀번호를 입력해 주세요.';
  return null;
}

/** 서버가 내려준 메시지를 그대로 쓴다. 없을 때만 코드로 대체한다. */
export function errorMessage(codeOrError) {
  if (codeOrError instanceof ApiError && codeOrError.message) return codeOrError.message;
  switch (codeOrError?.code || codeOrError) {
    case 'id_taken':
      return '이미 사용 중인 아이디입니다.';
    case 'no_user':
      return '존재하지 않는 아이디입니다.';
    case 'wrong_password':
      return '비밀번호가 올바르지 않습니다.';
    case 'network':
      return '네트워크에 연결할 수 없습니다.';
    default:
      return '문제가 발생했어요. 잠시 후 다시 시도해 주세요.';
  }
}

export function getCurrentUser() {
  return currentUser;
}

export function onUserChanged(callback) {
  listeners.add(callback);
  callback(currentUser);
  if (!restored) restoreSession();
  return () => listeners.delete(callback);
}

export async function signUp(id, password) {
  const data = await api('/api/auth/signup', {
    method: 'POST',
    body: { id, password },
  });
  setUser(data.user);
  return currentUser;
}

export async function signIn(id, password) {
  const data = await api('/api/auth/signin', {
    method: 'POST',
    body: { id, password },
  });
  setUser(data.user);
  return currentUser;
}

export async function signOut() {
  try {
    await api('/api/auth/signout', { method: 'POST' });
  } finally {
    // 서버 호출이 실패해도 화면상으로는 로그아웃시킨다.
    setUser(null);
  }
}

// ── 내부 ────────────────────────────────────────────────────

async function restoreSession() {
  restored = true;
  try {
    const data = await api('/api/auth/me');
    setUser(data.user || null);
  } catch {
    // 세션이 없거나 서버에 닿지 못한 것 — 비로그인으로 둔다.
    setUser(null);
  }
}

function setUser(user) {
  currentUser = user;
  for (const cb of listeners) cb(currentUser);
}
