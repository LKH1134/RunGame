import { getCurrentUser } from './auth.js';

// ─────────────────────────────────────────────────────────────
// 점수 저장 / 리더보드 조회. 지금은 localStorage 기반 스텁이다.
//
// 내일 Firestore로 교체할 때의 실제 구현:
//   submitScore      → scores 컬렉션에 이력 추가 (fire-and-forget)
//                      + leaderboard/{uid} 를 runTransaction으로 읽고
//                        newScore > bestScore 일 때만 갱신
//   fetchLeaderboard → query(collection(db,'leaderboard'),
//                            orderBy('bestScore','desc'), limit(100))
//
// 트랜잭션을 쓰는 이유: 동시 플레이나 중복 제출에도 최고 기록이
// 낮은 점수로 뒤집히지 않게 하기 위해서다.
// ─────────────────────────────────────────────────────────────

const STORAGE_BOARD = 'runner.stub.leaderboard';
const MAX_ROWS = 100;

export async function submitScore({ score, coins, meters }) {
  const user = getCurrentUser();
  // 비로그인 상태에서는 저장하지 않는다 (플레이 자체는 허용).
  if (!user) return { saved: false, reason: 'anonymous' };

  await tick();

  const board = readBoard();
  const prev = board[user.uid];

  // 최고 기록일 때만 갱신 — 낮은 점수로 덮어쓰지 않는다.
  if (prev && prev.bestScore >= score) {
    return { saved: true, isBest: false, bestScore: prev.bestScore };
  }

  board[user.uid] = {
    uid: user.uid,
    username: user.username,
    bestScore: score,
    coins,
    meters,
    updatedAt: Date.now(),
  };
  writeBoard(board);

  return { saved: true, isBest: true, bestScore: score };
}

export async function fetchLeaderboard(max = MAX_ROWS) {
  await tick();
  return Object.values(readBoard())
    .sort((a, b) => b.bestScore - a.bestScore || a.updatedAt - b.updatedAt)
    .slice(0, max);
}

export async function fetchMyBest() {
  const user = getCurrentUser();
  if (!user) return null;
  await tick();
  return readBoard()[user.uid] || null;
}

// ── 내부 ────────────────────────────────────────────────────

const tick = () => new Promise((r) => setTimeout(r, 150));

function readBoard() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_BOARD));
    if (saved) return saved;
  } catch {
    /* 손상된 값이면 시드로 되돌린다 */
  }
  const seeded = seed();
  writeBoard(seeded);
  return seeded;
}

function writeBoard(board) {
  localStorage.setItem(STORAGE_BOARD, JSON.stringify(board));
}

/** 리더보드 렌더링을 눈으로 확인하기 위한 더미 데이터. Firebase 연결 시 삭제. */
function seed() {
  const rows = [
    ['dummy-1', '러너킹', 4820, 152, 3300],
    ['dummy-2', 'coin_hunter', 3610, 201, 1600],
    ['dummy-3', 'jump.master', 2940, 88, 2060],
    ['dummy-4', 'slide-99', 1875, 47, 1405],
    ['dummy-5', 'newbie', 640, 12, 520],
  ];
  const board = {};
  rows.forEach(([uid, username, bestScore, coins, meters], i) => {
    board[uid] = {
      uid,
      username,
      bestScore,
      coins,
      meters,
      updatedAt: i,
    };
  });
  return board;
}
