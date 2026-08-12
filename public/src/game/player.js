import { CONFIG } from './config.js';

export const PlayerState = {
  RUN: 'RUN',
  JUMP: 'JUMP',
  SLIDE: 'SLIDE',
  DEAD: 'DEAD',
};

export class Player {
  constructor() {
    this.reset();
  }

  reset() {
    this.x = CONFIG.PLAYER_X;
    this.y = CONFIG.GROUND_Y; // y는 발 위치(하단)
    this.vy = 0;
    this.state = PlayerState.RUN;
    this.grounded = true;
    this.coyote = CONFIG.COYOTE_TIME;
    this.slideTime = 0;
    this.runCycle = 0; // 달리기 애니메이션용 위상
  }

  get height() {
    return this.state === PlayerState.SLIDE
      ? CONFIG.PLAYER_SLIDE_H
      : CONFIG.PLAYER_H;
  }

  /** 화면에 그려지는 사각형 */
  get bounds() {
    const h = this.height;
    return { x: this.x, y: this.y - h, w: CONFIG.PLAYER_W, h };
  }

  /** 충돌 판정용 사각형 — 시각 사각형보다 안쪽으로 축소한다. */
  get hitbox() {
    const h = this.height;
    return {
      x: this.x + CONFIG.HITBOX_INSET_X,
      y: this.y - h + CONFIG.HITBOX_INSET_TOP,
      w: CONFIG.PLAYER_W - CONFIG.HITBOX_INSET_X * 2,
      h: h - CONFIG.HITBOX_INSET_TOP,
    };
  }

  /** 지금 일어섰다면 차지할 히트박스 — 머리 위 여유 확인용 */
  get standingHitbox() {
    return {
      x: this.x + CONFIG.HITBOX_INSET_X,
      y: this.y - CONFIG.PLAYER_H + CONFIG.HITBOX_INSET_TOP,
      w: CONFIG.PLAYER_W - CONFIG.HITBOX_INSET_X * 2,
      h: CONFIG.PLAYER_H - CONFIG.HITBOX_INSET_TOP,
    };
  }

  /**
   * @param {number} dt
   * @param {import('./input.js').Input} input
   * @param {(rect: object) => boolean} canStand
   *        일어설 공간이 있는지 묻는 콜백. 막대 아래에서 시프트를 떼도
   *        바로 머리를 박지 않도록 슬라이딩을 유지하는 데 쓴다.
   */
  update(dt, input, canStand = () => true) {
    if (this.state === PlayerState.DEAD) return;

    this.runCycle += dt * (this.grounded ? 12 : 4);

    // --- 점프 ---
    const canJump = this.grounded || this.coyote > 0;
    if (input.jumpBuffered && canJump) {
      input.consumeJump();
      // 막대 아래에서 점프하면 머리를 박는다 — 그건 플레이어의 판단으로 둔다.
      this.vy = CONFIG.JUMP_VELOCITY;
      this.grounded = false;
      this.coyote = 0;
      this.slideTime = 0;
      this.state = PlayerState.JUMP;
    }

    // --- 중력 ---
    this.vy += CONFIG.GRAVITY * dt;
    this.y += this.vy * dt;

    if (this.y >= CONFIG.GROUND_Y) {
      this.y = CONFIG.GROUND_Y;
      this.vy = 0;
      if (!this.grounded) {
        this.grounded = true;
        this.state = PlayerState.RUN;
      }
      this.coyote = CONFIG.COYOTE_TIME;
    } else {
      if (this.grounded) this.grounded = false;
      this.coyote = Math.max(0, this.coyote - dt);
      if (this.state !== PlayerState.JUMP) this.state = PlayerState.JUMP;
    }

    // --- 슬라이딩 (지상에서만) ---
    if (this.state === PlayerState.SLIDE) {
      this.slideTime += dt;
      const wantsUp = !input.slideHeld && this.slideTime >= CONFIG.SLIDE_MIN_TIME;
      if (wantsUp && canStand(this.standingHitbox)) {
        this.state = PlayerState.RUN;
        this.slideTime = 0;
      }
    } else if (this.grounded && input.slideHeld && this.state === PlayerState.RUN) {
      this.state = PlayerState.SLIDE;
      this.slideTime = 0;
    }
  }

  kill() {
    this.state = PlayerState.DEAD;
    this.vy = 0;
  }
}
