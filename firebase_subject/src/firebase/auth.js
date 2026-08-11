import { IS_CONFIGURED } from './config.js';

// ─────────────────────────────────────────────────────────────
// 인증 모듈. 지금은 localStorage 기반 스텁이다.
//
// ★ 임시 구현 경고 ★
//   비밀번호를 localStorage에 그대로 보관한다. 오직 UI 흐름을 검증하기
//   위한 껍데기이며, Firebase Auth 연결과 동시에 통째로 삭제된다.
//   실제 사용자 데이터를 넣지 말 것.
//
// 아래 5개 export의 시그니처는 Firebase 버전과 동일하게 유지한다.
// 내일은 이 파일 내부만 교체하면 되고, 호출부(ui/*)는 손대지 않는다.
// ─────────────────────────────────────────────────────────────

const STORAGE_USERS = 'runner.stub.users';
const STORAGE_SESSION = 'runner.stub.session';

const listeners = new Set();
let currentUser = null;

/** 아이디 허용 문자 — 이메일 로컬파트로 유효한 범위 (PLAN §2.1) */
const ID_PATTERN = /^[A-Za-z0-9._-]{2,20}$/;

export const ID_HINT = '영문·숫자와 . _ - 만 사용할 수 있어요 (2~20자)';

export function validateId(id) {
  if (!id) return '아이디를 입력해 주세요.';
  if (!ID_PATTERN.test(id)) return ID_HINT;
  return null;
}

export function validatePassword(pw) {
  if (!pw) return '비밀번호를 입력해 주세요.';
  return null;
}

/** Firebase 에러 코드 → 한글 메시지 */
export function errorMessage(code) {
  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 사용 중인 아이디입니다.';
    case 'auth/user-not-found':
      return '존재하지 않는 아이디입니다.';
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return '비밀번호가 올바르지 않습니다.';
    case 'auth/too-many-requests':
      return '시도가 너무 잦습니다. 잠시 후 다시 시도해 주세요.';
    case 'auth/network-request-failed':
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
  return () => listeners.delete(callback);
}

export async function signUp(id, password) {
  await tick();
  const users = readUsers();
  const key = id.toLowerCase();
  if (users[key]) throw authError('auth/email-already-in-use');

  users[key] = {
    uid: `local-${key}`,
    username: id, // 표시용 원본
    usernameLower: key,
    password, // 스텁 전용. Firebase 연결 시 사라진다.
    createdAt: Date.now(),
  };
  writeUsers(users);
  setSession(users[key]);
  return currentUser;
}

export async function signIn(id, password) {
  await tick();
  const users = readUsers();
  const record = users[id.toLowerCase()];
  if (!record) throw authError('auth/user-not-found');
  if (record.password !== password) throw authError('auth/wrong-password');
  setSession(record);
  return currentUser;
}

export async function signOut() {
  await tick();
  localStorage.removeItem(STORAGE_SESSION);
  currentUser = null;
  emit();
}

// ── 내부 ────────────────────────────────────────────────────

function authError(code) {
  const err = new Error(code);
  err.code = code;
  return err;
}

const tick = () => new Promise((r) => setTimeout(r, 120));

function readUsers() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_USERS)) || {};
  } catch {
    return {};
  }
}

function writeUsers(users) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(users));
}

function setSession(record) {
  currentUser = { uid: record.uid, username: record.username };
  localStorage.setItem(STORAGE_SESSION, JSON.stringify(currentUser));
  emit();
}

function emit() {
  for (const cb of listeners) cb(currentUser);
}

function restoreSession() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_SESSION));
    if (saved && saved.uid) currentUser = saved;
  } catch {
    currentUser = null;
  }
}

// Firebase의 onAuthStateChanged가 새로고침 후 세션을 복원하는 것과 같은 역할.
if (!IS_CONFIGURED) restoreSession();
