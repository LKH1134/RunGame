import { CONFIG } from './config.js';
import { aabb } from './collision.js';

// 엔티티 목록과 스크롤을 담당한다. 그리기는 전혀 하지 않는다.
export class World {
  constructor() {
    this.reset();
  }

  reset() {
    this.obstacles = [];
    this.coins = [];
    this.traveled = 0; // 누적 이동 픽셀
    this.elapsed = 0; // 플레이 경과 시간(s)
    this.speed = CONFIG.SPEED_START;
  }

  update(dt) {
    this.elapsed += dt;

    // 선형 증가라 예측 가능하고 튜닝이 쉽다.
    this.speed = Math.min(
      CONFIG.SPEED_MAX,
      CONFIG.SPEED_START + CONFIG.SPEED_ACCEL * this.elapsed
    );

    const dx = this.speed * dt;
    this.traveled += dx;

    for (const o of this.obstacles) o.x -= dx;
    for (const c of this.coins) c.x -= dx;

    // 화면 밖으로 나간 것 정리
    this.obstacles = this.obstacles.filter((o) => o.x + o.w > -50);
    this.coins = this.coins.filter((c) => c.x + c.w > -50 && !c.taken);
  }

  addObstacle(obstacle) {
    this.obstacles.push(obstacle);
  }

  addCoin(coin) {
    this.coins.push(coin);
  }

  /** 그 자리에서 일어설 공간이 있는가 (막대 아래 강제 슬라이딩 유지용) */
  canStandAt(rect) {
    return !this.obstacles.some((o) => aabb(rect, o));
  }

  get meters() {
    return Math.floor(this.traveled / CONFIG.PX_PER_METER);
  }
}
