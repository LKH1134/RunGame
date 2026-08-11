// ─────────────────────────────────────────────────────────────
// Firebase 초기화 자리 — 아직 연결하지 않았다.
//
// 내일 할 일:
//   1. Firebase 콘솔에서 프로젝트 생성 → 웹 앱 등록
//   2. Authentication → Email/Password 제공자 활성화
//   3. Firestore 생성 (프로덕션 모드) 후 firestore.rules 배포
//   4. 아래 firebaseConfig를 콘솔의 값으로 교체하고 IS_CONFIGURED를 true로
//   5. 아래 주석 처리된 initializeApp 블록을 살린다
//
// IS_CONFIGURED가 false인 동안 auth.js / scores.js는 localStorage 기반
// 로컬 스텁으로 동작한다. UI와 화면 전환을 그대로 검증할 수 있고,
// 실제 연결 시 두 모듈의 내부 구현만 갈아끼우면 된다.
// ─────────────────────────────────────────────────────────────

export const IS_CONFIGURED = false;

export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
// import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
// import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
//
// export const app = initializeApp(firebaseConfig);
// export const auth = getAuth(app);
// export const db = getFirestore(app);

// ── 아이디/비밀번호 규칙 흡수 (PLAN §2.1) ──────────────────
// Firebase Auth는 이메일 형식과 비밀번호 6자 이상을 강제하지만,
// 사용자에게는 그 제약을 노출하지 않는다.
export const AUTH_DOMAIN_SUFFIX = '@runner.local';

// 짧은 비밀번호를 6자 이상으로 맞추기 위한 고정 접미사.
// 클라이언트 상수라 비밀이 아니며, 보안 강도를 올리는 장치가 아니다.
// 순수하게 Firebase의 길이 제약을 회피하기 위한 것이다.
export const PW_PAD = '::runner-pad::';

export const toEmail = (id) => `${id.toLowerCase()}${AUTH_DOMAIN_SUFFIX}`;
export const toPassword = (pw) => `${pw}${PW_PAD}`;
