// RUNGAME 백엔드 — Cloudflare Worker + D1
//
// 정적 자산(public/)은 assets 바인딩이 먼저 처리하고, 여기까지 오는 건
// /api/* 와 매칭되는 파일이 없는 경로뿐이다.
//
// 인증은 Firebase Auth 같은 관리형 서비스를 쓰지 않으므로 직접 구현한다.
//   - 비밀번호: PBKDF2-SHA256 (계정별 랜덤 salt) — 평문 저장 없음
//   - 세션: HMAC-SHA256으로 서명한 토큰을 HttpOnly 쿠키로. 서버는 상태를 갖지 않는다.

import {
  hashPassword,
  verifyPassword,
  createSessionToken,
  readSessionToken,
} from './crypto.js';

const SESSION_COOKIE = 'rg_session';
const SESSION_TTL_SEC = 60 * 60 * 24 * 30; // 30일
const MAX_SCORE = 1_000_000;
const COIN_VALUE = 10; // 클라이언트 game/config.js와 반드시 같아야 한다

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith('/api/')) {
      // 정적 자산으로 넘긴다 (SPA 진입점 포함)
      return env.ASSETS.fetch(request);
    }

    try {
      return await route(request, env, url);
    } catch (err) {
      console.error('unhandled', err?.stack || err);
      return json({ error: 'internal', message: '서버 오류가 발생했어요.' }, 500);
    }
  },
};

async function route(request, env, url) {
  const path = url.pathname;
  const method = request.method;

  if (method === 'OPTIONS') return new Response(null, { status: 204 });

  // localhost의 wrangler dev는 http라 Secure 쿠키가 저장되지 않는다.
  // 배포(https)에서는 항상 Secure가 붙는다.
  const secure = url.protocol === 'https:';

  if (path === '/api/auth/signup' && method === 'POST') return signup(request, env, secure);
  if (path === '/api/auth/signin' && method === 'POST') return signin(request, env, secure);
  if (path === '/api/auth/signout' && method === 'POST') return signout(secure);
  if (path === '/api/auth/me' && method === 'GET') return me(request, env);
  if (path === '/api/scores' && method === 'POST') return submitScore(request, env);
  if (path === '/api/leaderboard' && method === 'GET') return leaderboard(request, env, url);

  return json({ error: 'not_found', message: '없는 경로입니다.' }, 404);
}

// ── 인증 ────────────────────────────────────────────────────

/**
 * 아이디 규칙.
 * Firebase Auth를 쓸 때는 이메일 형식이라 영문·숫자·`._-` 로 묶여 있었지만,
 * 직접 저장하는 지금은 그 제약이 사라졌다. 한글 아이디도 그대로 받는다.
 * 공백·제어문자만 막는다 (표시가 깨지고 앞뒤 공백으로 사칭이 가능해서).
 */
function validateId(id) {
  if (typeof id !== 'string') return '아이디를 입력해 주세요.';
  const trimmed = id.trim();
  if (trimmed !== id) return '아이디 앞뒤에 공백을 쓸 수 없어요.';
  if (trimmed.length < 2 || trimmed.length > 20) return '아이디는 2~20자로 입력해 주세요.';
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(trimmed)) return '아이디에 공백이나 제어문자를 쓸 수 없어요.';
  return null;
}

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length === 0) return '비밀번호를 입력해 주세요.';
  if (pw.length > 200) return '비밀번호가 너무 깁니다.';
  return null;
}

async function signup(request, env, secure) {
  const body = await readJson(request);
  if (!body) return json({ error: 'bad_request', message: '요청이 올바르지 않습니다.' }, 400);

  const { id, password } = body;
  const idError = validateId(id);
  if (idError) return json({ error: 'invalid_id', message: idError }, 400);
  const pwError = validatePassword(password);
  if (pwError) return json({ error: 'invalid_password', message: pwError }, 400);

  const lower = id.toLowerCase();
  const { hash, salt } = await hashPassword(password);

  let result;
  try {
    result = await env.DB.prepare(
      `INSERT INTO users (username, username_lower, password_hash, password_salt, created_at)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id, username`
    )
      .bind(id, lower, hash, salt, Date.now())
      .first();
  } catch (err) {
    // username_lower UNIQUE 제약 위반 = 아이디 중복.
    // 별도의 예약 테이블 없이 이걸로 중복 판정이 끝난다.
    if (String(err?.message || '').includes('UNIQUE')) {
      return json({ error: 'id_taken', message: '이미 사용 중인 아이디입니다.' }, 409);
    }
    throw err;
  }

  return withSession(
    json({ user: { uid: String(result.id), username: result.username } }),
    env,
    result.id,
    secure
  );
}

async function signin(request, env, secure) {
  const body = await readJson(request);
  if (!body) return json({ error: 'bad_request', message: '요청이 올바르지 않습니다.' }, 400);

  const { id, password } = body;
  if (typeof id !== 'string' || typeof password !== 'string') {
    return json({ error: 'bad_request', message: '요청이 올바르지 않습니다.' }, 400);
  }

  const row = await env.DB.prepare(
    `SELECT id, username, password_hash, password_salt
     FROM users WHERE username_lower = ?`
  )
    .bind(id.toLowerCase())
    .first();

  // 아이디 없음과 비밀번호 틀림을 구분해 주면 계정 존재 여부가 새어 나간다.
  // 다만 이 과제에서는 사용자 경험상 구분해 달라는 요구가 있어 나눠 둔다.
  if (!row) return json({ error: 'no_user', message: '존재하지 않는 아이디입니다.' }, 401);

  const ok = await verifyPassword(password, row.password_hash, row.password_salt);
  if (!ok) return json({ error: 'wrong_password', message: '비밀번호가 올바르지 않습니다.' }, 401);

  return withSession(
    json({ user: { uid: String(row.id), username: row.username } }),
    env,
    row.id,
    secure
  );
}

function signout(secure) {
  const res = json({ ok: true });
  res.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Strict; Path=/; Max-Age=0`
  );
  return res;
}

async function me(request, env) {
  const user = await currentUser(request, env);
  return json({ user });
}

async function currentUser(request, env) {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;

  const userId = await readSessionToken(token, sessionSecret(env));
  if (!userId) return null;

  const row = await env.DB.prepare(`SELECT id, username FROM users WHERE id = ?`)
    .bind(userId)
    .first();
  return row ? { uid: String(row.id), username: row.username } : null;
}

async function withSession(response, env, userId, secure) {
  const token = await createSessionToken(userId, sessionSecret(env), SESSION_TTL_SEC);
  response.headers.append(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; HttpOnly;${secure ? ' Secure;' : ''} SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_SEC}`
  );
  return response;
}

function sessionSecret(env) {
  if (env.SESSION_SECRET) return env.SESSION_SECRET;
  // 배포 전에 반드시 설정해야 한다:
  //   npx wrangler secret put SESSION_SECRET
  // 없으면 세션 위조가 가능하므로 로컬 개발에서만 허용한다.
  console.warn('SESSION_SECRET 미설정 — 개발용 기본값을 사용합니다. 배포 전 설정하세요.');
  return 'dev-only-insecure-secret';
}

// ── 점수 / 랭킹 ─────────────────────────────────────────────

async function submitScore(request, env) {
  const user = await currentUser(request, env);
  if (!user) {
    return json({ error: 'unauthorized', message: '로그인이 필요합니다.' }, 401);
  }

  const body = await readJson(request);
  if (!body) return json({ error: 'bad_request', message: '요청이 올바르지 않습니다.' }, 400);

  const score = toInt(body.score);
  const coins = toInt(body.coins);
  const meters = toInt(body.meters);

  // 서버 측 정합성 검사.
  //
  // ★ 한계를 분명히 해 둔다 ★
  // 점수를 클라이언트가 계산해 보내는 구조라, 개발자 도구로 임의의 값을
  // 올리는 것은 이 검사로 막을 수 없다. 여기서 걸러지는 건 형식 오류와
  // 명백한 범위 이탈뿐이다. 완전한 방어는 입력 리플레이를 서버에서
  // 재시뮬레이션해야 하며 이 과제의 범위 밖이다.
  if (score === null || coins === null || meters === null) {
    return json({ error: 'bad_score', message: '점수 형식이 올바르지 않습니다.' }, 400);
  }
  if (score < 0 || coins < 0 || meters < 0 || score > MAX_SCORE) {
    return json({ error: 'bad_score', message: '점수 범위가 올바르지 않습니다.' }, 400);
  }
  if (score !== meters + coins * COIN_VALUE) {
    return json({ error: 'bad_score', message: '점수 계산이 맞지 않습니다.' }, 400);
  }

  const now = Date.now();
  const userId = Number(user.uid);

  // 이력은 항상 남긴다.
  await env.DB.prepare(
    `INSERT INTO scores (user_id, score, coins, meters, played_at) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(userId, score, coins, meters, now)
    .run();

  // 최고 기록 갱신은 단일 문장으로 처리한다.
  // "읽고 비교한 뒤 쓰기"로 나누면 동시 제출 시 낮은 점수가 높은 점수를
  // 덮어쓸 수 있다. UPSERT + WHERE 는 원자적이라 그 경합이 없다.
  const updated = await env.DB.prepare(
    `INSERT INTO leaderboard (user_id, best_score, coins, meters, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       best_score = excluded.best_score,
       coins      = excluded.coins,
       meters     = excluded.meters,
       updated_at = excluded.updated_at
     WHERE excluded.best_score > leaderboard.best_score
     RETURNING best_score`
  )
    .bind(userId, score, coins, meters, now)
    .first();

  const isBest = updated !== null;
  const best = isBest
    ? updated.best_score
    : (
        await env.DB.prepare(`SELECT best_score FROM leaderboard WHERE user_id = ?`)
          .bind(userId)
          .first()
      )?.best_score ?? score;

  return json({ saved: true, isBest, bestScore: best });
}

async function leaderboard(request, env, url) {
  const limit = Math.min(Math.max(toInt(url.searchParams.get('limit')) ?? 100, 1), 100);

  const { results } = await env.DB.prepare(
    `SELECT u.id AS uid, u.username, l.best_score, l.coins, l.meters, l.updated_at
     FROM leaderboard l
     JOIN users u ON u.id = l.user_id
     ORDER BY l.best_score DESC, l.updated_at ASC
     LIMIT ?`
  )
    .bind(limit)
    .all();

  return json({
    rows: results.map((r) => ({
      uid: String(r.uid),
      username: r.username,
      bestScore: r.best_score,
      coins: r.coins,
      meters: r.meters,
      updatedAt: r.updated_at,
    })),
  });
}

// ── 유틸 ────────────────────────────────────────────────────

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null;
  }
}

function toInt(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isInteger(n) ? n : null;
}

function readCookie(request, name) {
  const header = request.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return rest.join('=');
  }
  return null;
}
