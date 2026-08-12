-- D1 스키마. 적용:
--   npx wrangler d1 execute rungame --local --file=./schema.sql
--   npx wrangler d1 execute rungame --remote --file=./schema.sql

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  username       TEXT    NOT NULL,          -- 표시용 원본 (대소문자 보존)
  username_lower TEXT    NOT NULL UNIQUE,   -- 중복 판정용. UNIQUE가 곧 아이디 중복 검사다.
  password_hash  TEXT    NOT NULL,          -- PBKDF2-SHA256, base64
  password_salt  TEXT    NOT NULL,          -- 계정마다 랜덤 16바이트, base64
  created_at     INTEGER NOT NULL
);

-- 랭킹 조회의 단일 소스. 유저당 1행이라 정렬 한 번으로 끝난다.
-- scores를 그대로 정렬하면 한 사람이 상위권을 도배한다.
CREATE TABLE IF NOT EXISTS leaderboard (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  best_score INTEGER NOT NULL,
  coins      INTEGER NOT NULL,   -- 최고 기록 당시의 동전 수
  meters     INTEGER NOT NULL,   -- 최고 기록 당시의 거리
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_best
  ON leaderboard(best_score DESC, updated_at ASC);

-- 전체 플레이 이력. 랭킹에는 불필요하며 "내 기록" 화면용이다.
CREATE TABLE IF NOT EXISTS scores (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score     INTEGER NOT NULL,
  coins     INTEGER NOT NULL,
  meters    INTEGER NOT NULL,
  played_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scores_user ON scores(user_id, played_at DESC);
