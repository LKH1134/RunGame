import {
  signUp,
  signIn,
  errorMessage,
  validateId,
  validatePassword,
  ID_HINT,
} from '../firebase/auth.js';

const el = (id) => document.getElementById(id);

let mode = 'signin'; // 'signin' | 'signup'
let busy = false;
let nodes = {};

export function initAuthModal() {
  nodes = {
    modal: el('auth-modal'),
    backdrop: el('auth-backdrop'),
    form: el('auth-form'),
    id: el('auth-id'),
    pw: el('auth-pw'),
    hint: el('auth-hint'),
    error: el('auth-error'),
    submit: el('auth-submit'),
    close: el('auth-close'),
    tabSignin: el('auth-tab-signin'),
    tabSignup: el('auth-tab-signup'),
  };

  nodes.hint.textContent = ID_HINT;

  nodes.tabSignin.addEventListener('click', () => setMode('signin'));
  nodes.tabSignup.addEventListener('click', () => setMode('signup'));
  nodes.close.addEventListener('click', closeAuthModal);
  nodes.backdrop.addEventListener('click', closeAuthModal);
  nodes.form.addEventListener('submit', onSubmit);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !nodes.modal.hidden) closeAuthModal();
  });

  setMode('signin');
}

export function openAuthModal(initialMode = 'signin') {
  setMode(initialMode);
  setError('');
  nodes.form.reset();
  nodes.modal.hidden = false;
  // 모달이 열려 있는 동안 게임 키 입력이 새는 것을 막기 위해 포커스를 준다.
  setTimeout(() => nodes.id.focus(), 0);
}

export function closeAuthModal() {
  nodes.modal.hidden = true;
}

export function isAuthModalOpen() {
  return !nodes.modal.hidden;
}

function setMode(next) {
  mode = next;
  const signup = mode === 'signup';
  nodes.tabSignin.classList.toggle('is-active', !signup);
  nodes.tabSignup.classList.toggle('is-active', signup);
  nodes.submit.textContent = signup ? '회원가입' : '로그인';
  nodes.hint.hidden = !signup;
  setError('');
}

function setError(message) {
  nodes.error.textContent = message;
  nodes.error.hidden = !message;
}

function setBusy(next) {
  busy = next;
  nodes.submit.disabled = next;
  nodes.submit.textContent = next
    ? '처리 중…'
    : mode === 'signup'
      ? '회원가입'
      : '로그인';
}

async function onSubmit(e) {
  e.preventDefault();
  if (busy) return;

  const id = nodes.id.value.trim();
  const pw = nodes.pw.value;

  const idError = validateId(id);
  if (idError) return setError(idError);
  const pwError = validatePassword(pw);
  if (pwError) return setError(pwError);

  setError('');
  setBusy(true);
  try {
    if (mode === 'signup') await signUp(id, pw);
    else await signIn(id, pw);
    closeAuthModal();
  } catch (err) {
    setError(errorMessage(err.code));
  } finally {
    setBusy(false);
  }
}
