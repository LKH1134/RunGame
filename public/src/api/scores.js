import { api } from './client.js';
import { getCurrentUser } from './auth.js';

// 점수 저장과 랭킹 조회. 실제 판정은 모두 Worker가 한다.
//   - 최고 기록 갱신 여부: D1의 UPSERT ... WHERE 로 원자적으로 처리
//   - 점수 정합성(score === meters + coins×10): 서버가 재계산해 검사

export async function submitScore({ score, coins, meters }) {
  // 비로그인 상태에서는 아예 보내지 않는다 (서버도 401로 막는다).
  if (!getCurrentUser()) return { saved: false, reason: 'anonymous' };

  const data = await api('/api/scores', {
    method: 'POST',
    body: { score, coins, meters },
  });

  return {
    saved: true,
    isBest: Boolean(data.isBest),
    bestScore: data.bestScore,
  };
}

export async function fetchLeaderboard(max = 100) {
  const data = await api(`/api/leaderboard?limit=${max}`);
  return data.rows || [];
}
