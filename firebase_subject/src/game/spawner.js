import { CONFIG, OBSTACLE, airTime } from './config.js';

const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const clamp01 = (v) => Math.max(0, Math.min(1, v));

const COIN_PATTERN = { LINE: 'LINE', ARCH: 'ARCH', LOW: 'LOW' };

/**
 * 거리 기반 스포너. 다음 스폰까지의 간격을 "현재 속도"로부터 계산하므로
 * 속도가 올라도 물리적으로 통과 불가능한 배치가 나오지 않는다.
 * 난이도 축은 두 개다 — 속도(자동)와 배치 밀도(difficultyTightness).
 */
export class Spawner {
  constructor() {
    this.reset();
  }

  reset() {
    this.distToNext = 520; // 첫 스폰까지 여유
    this.lastType = null;
    this.sameTypeRun = 0;
    this.nextType = OBSTACLE.GROUND_BLOCK;
  }

  update(dt, world) {
    this.distToNext -= world.speed * dt;
    if (this.distToNext > 0) return;

    // 첫 3초는 장애물 없이 동전만 (워밍업)
    if (world.elapsed < CONFIG.WARMUP_TIME) {
      const startX = CONFIG.VIEW_W + 60;
      this._spawnCoins(world, startX, startX + 300, COIN_PATTERN.LINE);
      this.distToNext = world.speed * 1.1;
      return;
    }

    const spawnX = CONFIG.VIEW_W + 40;
    const type = this.nextType;
    const obstacle = this._makeObstacle(type, spawnX);
    world.addObstacle(obstacle);

    // 같은 타입 연속 카운트
    if (type === this.lastType) this.sameTypeRun += 1;
    else this.sameTypeRun = 1;
    this.lastType = type;

    // 다음 장애물의 타입과 간격을 지금 정한다.
    // (간격 규칙이 "직전 타입 → 다음 타입" 조합에 걸려 있기 때문)
    const gap = this._scheduleNext(world);

    // 이번 장애물과 다음 장애물 사이의 빈 구간에 동전을 깐다.
    const gapStart = spawnX + obstacle.w + 70;
    const gapEnd = spawnX + gap - 70;
    if (gapEnd - gapStart > CONFIG.COIN_SPACING * 2) {
      this._spawnCoins(world, gapStart, gapEnd, this._pickCoinPattern());
    }
  }

  _minGap(world) {
    return world.speed * airTime() * CONFIG.GAP_MIN_MULTIPLIER;
  }

  _tightness(world) {
    const t = clamp01(world.elapsed / CONFIG.TIGHTNESS_RAMP_TIME);
    return (
      CONFIG.TIGHTNESS_START +
      (CONFIG.TIGHTNESS_END - CONFIG.TIGHTNESS_START) * t
    );
  }

  _scheduleNext(world) {
    const type = this._pickType();
    const minGap = this._minGap(world);
    let gap =
      minGap *
      rand(CONFIG.GAP_RANDOM_MIN, CONFIG.GAP_RANDOM_MAX) *
      this._tightness(world);

    // 슬라이드에서 일어나 점프하려면 시간이 더 필요하다.
    if (this.lastType === OBSTACLE.OVERHEAD_BAR && type === OBSTACLE.GROUND_BLOCK) {
      gap = Math.max(gap, minGap * CONFIG.BAR_TO_BLOCK_MULTIPLIER);
    }

    this.nextType = type;
    this.distToNext = gap;
    return gap;
  }

  _pickType() {
    // 같은 타입 3연속 금지 — 단조로움 방지
    if (this.sameTypeRun >= CONFIG.MAX_SAME_TYPE_RUN) {
      return this.lastType === OBSTACLE.GROUND_BLOCK
        ? OBSTACLE.OVERHEAD_BAR
        : OBSTACLE.GROUND_BLOCK;
    }
    return Math.random() < 0.58
      ? OBSTACLE.GROUND_BLOCK
      : OBSTACLE.OVERHEAD_BAR;
  }

  _makeObstacle(type, x) {
    if (type === OBSTACLE.GROUND_BLOCK) {
      const w = rand(CONFIG.BLOCK_W_MIN, CONFIG.BLOCK_W_MAX);
      const h = rand(CONFIG.BLOCK_H_MIN, CONFIG.BLOCK_H_MAX);
      return { type, x, y: CONFIG.GROUND_Y - h, w, h };
    }
    const w = rand(CONFIG.BAR_W_MIN, CONFIG.BAR_W_MAX);
    const h = rand(CONFIG.BAR_H_MIN, CONFIG.BAR_H_MAX);
    // 하단을 GROUND_Y - 34 로 고정해야 "서면 걸리고 슬라이드하면 통과"가 보장된다.
    return {
      type,
      x,
      y: CONFIG.GROUND_Y - CONFIG.BAR_BOTTOM_OFFSET - h,
      w,
      h,
    };
  }

  _pickCoinPattern() {
    // 다음 장애물이 막대라면 아치(공중 체공)는 위험하다 — 착지 후 슬라이딩해야 하므로.
    if (this.nextType === OBSTACLE.OVERHEAD_BAR) {
      return Math.random() < 0.5 ? COIN_PATTERN.LINE : COIN_PATTERN.LOW;
    }
    const r = Math.random();
    if (r < 0.4) return COIN_PATTERN.ARCH;
    if (r < 0.75) return COIN_PATTERN.LINE;
    return COIN_PATTERN.LOW;
  }

  _spawnCoins(world, startX, endX, pattern) {
    const size = CONFIG.COIN_SIZE;
    const maxBySpace = Math.floor((endX - startX) / CONFIG.COIN_SPACING) + 1;
    const count = Math.min(
      maxBySpace,
      randInt(CONFIG.COIN_GROUP_MIN, CONFIG.COIN_GROUP_MAX)
    );
    if (count <= 0) return;

    for (let i = 0; i < count; i++) {
      const x = startX + i * CONFIG.COIN_SPACING;
      const cy = this._coinCenterY(pattern, i, count, world.speed);
      world.addCoin({
        x,
        y: cy - size / 2,
        w: size,
        h: size,
        taken: false,
      });
    }
  }

  _coinCenterY(pattern, i, count, speed) {
    if (pattern === COIN_PATTERN.LOW) return CONFIG.GROUND_Y - 16;
    if (pattern === COIN_PATTERN.LINE) return CONFIG.GROUND_Y - 42;

    // ARCH: 실제 점프 궤적을 따라 배치해 "점프하면 자연스럽게 다 먹히는" 줄을 만든다.
    const total = airTime();
    const t = total * ((i + 0.5) / count);
    const jumpHeight =
      Math.abs(CONFIG.JUMP_VELOCITY) * t - 0.5 * CONFIG.GRAVITY * t * t;
    const footY = CONFIG.GROUND_Y - Math.max(0, jumpHeight);
    return footY - CONFIG.PLAYER_H / 2;
  }
}
