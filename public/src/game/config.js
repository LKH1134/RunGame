// 모든 튜닝 상수를 한곳에 모은다.
// 객체로 내보내는 이유: 콘솔에서 window.CONFIG.SPEED_ACCEL = 12 처럼
// 실시간으로 만지며 난이도를 조정하기 위해서다 (PLAN 4단계 3번).
export const CONFIG = {
  // 논리 해상도 — 캔버스는 CSS로 스케일되지만 내부 좌표계는 항상 이 크기다.
  VIEW_W: 960,
  VIEW_H: 540,

  // 물리
  GROUND_Y: 460, // 바닥 표면 y (플레이어의 발 위치)
  GRAVITY: 2200, // px/s²
  JUMP_VELOCITY: -780, // px/s → 체공 ~0.71s, 최고점 ~138px

  // 플레이어
  PLAYER_X: 150, // 화면상 x는 고정. 월드가 왼쪽으로 흐른다.
  PLAYER_W: 40,
  PLAYER_H: 60,
  PLAYER_SLIDE_H: 30,
  SLIDE_MIN_TIME: 0.25, // s — 슬라이딩 최소 지속시간

  // 조작감 보정
  COYOTE_TIME: 0.08, // 발판에서 떨어진 직후 점프 허용 시간
  JUMP_BUFFER_TIME: 0.1, // 착지 직전 점프 입력을 저장해 두는 시간

  // 히트박스 축소 — 관대한 판정이 억울한 죽음을 줄인다.
  HITBOX_INSET_X: 4,
  HITBOX_INSET_TOP: 3,

  // 속도 곡선: speed = min(SPEED_MAX, SPEED_START + SPEED_ACCEL × elapsed)
  SPEED_START: 340,
  SPEED_ACCEL: 8,
  SPEED_MAX: 900, // 약 70초에 도달

  // 스폰 간격
  GAP_MIN_MULTIPLIER: 1.15, // 점프 한 번이 착지할 여유
  GAP_RANDOM_MIN: 1.0,
  GAP_RANDOM_MAX: 2.2,
  BAR_TO_BLOCK_MULTIPLIER: 1.4, // 막대 직후 바닥 블록은 더 멀리 (슬라이드 복귀 시간)
  MAX_SAME_TYPE_RUN: 2, // 같은 타입 3연속 금지

  // 밀도 난이도 — 속도와 별개의 축으로 서서히 조인다.
  TIGHTNESS_START: 1.0,
  TIGHTNESS_END: 0.75,
  TIGHTNESS_RAMP_TIME: 60, // s

  // 장애물 크기
  BLOCK_W_MIN: 30,
  BLOCK_W_MAX: 50,
  BLOCK_H_MIN: 45,
  BLOCK_H_MAX: 75,
  BAR_W_MIN: 60,
  BAR_W_MAX: 110,
  BAR_H_MIN: 26,
  BAR_H_MAX: 40,
  BAR_BOTTOM_OFFSET: 34, // 막대 하단 = GROUND_Y - 34 (선 자세 60 불가 / 슬라이드 30 통과)

  // 동전
  COIN_SIZE: 22,
  COIN_VALUE: 10, // 동전 1개 = 10m 가치
  COIN_GROUP_MIN: 3,
  COIN_GROUP_MAX: 6,
  COIN_SPACING: 46,

  // 진행
  WARMUP_TIME: 3, // 첫 3초는 장애물 없이 동전만
  DEATH_ANIM_TIME: 0.4, // 사망 연출 후 결과 패널
  COUNTDOWN_TIME: 3.5, // 3 → 2 → 1 → GO!

  // 점수
  PX_PER_METER: 10,
};

// 고정 타임스텝. 가변 dt를 쓰면 주사율에 따라 점프 높이와 난이도가 달라져
// 리더보드의 공정성이 깨진다. 여기는 타협하지 않는다.
export const FIXED_DT = 1 / 60;

// 점프 체공 시간 — 스폰 간격 계산의 기준값.
export function airTime() {
  return (2 * Math.abs(CONFIG.JUMP_VELOCITY)) / CONFIG.GRAVITY;
}

export const OBSTACLE = {
  GROUND_BLOCK: 'GROUND_BLOCK',
  OVERHEAD_BAR: 'OVERHEAD_BAR',
};
