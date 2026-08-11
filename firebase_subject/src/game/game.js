import { CONFIG, FIXED_DT } from './config.js';
import { Input } from './input.js';
import { Player } from './player.js';
import { World } from './world.js';
import { Spawner } from './spawner.js';
import { Renderer } from './renderer.js';
import { aabb, anyHit } from './collision.js';

export const GameState = {
  IDLE: 'IDLE',
  COUNTDOWN: 'COUNTDOWN',
  PLAYING: 'PLAYING',
  DYING: 'DYING',
  RESULT: 'RESULT',
};

export class Game {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{onCountdown?:Function, onStats?:Function, onResult?:Function}} hooks
   */
  constructor(canvas, hooks = {}) {
    this.renderer = new Renderer(canvas);
    this.input = new Input();
    this.world = new World();
    this.player = new Player();
    this.spawner = new Spawner();
    this.hooks = hooks;

    this.state = GameState.IDLE;
    this.running = false;
    this.paused = false;
    this.coins = 0;
    this.shake = 0;
    this.fade = 0;
    this.deathTimer = 0;
    this.countdown = 0;
    this._lastLabel = undefined;

    this.input.attach(window);
    this._frame = this._frame.bind(this);
  }

  /** 리셋 후 카운트다운부터 시작 */
  start() {
    this.world.reset();
    this.player.reset();
    this.spawner.reset();
    this.input.reset();
    this.input.setEnabled(false);

    this.coins = 0;
    this.shake = 0;
    this.fade = 0;
    this.deathTimer = 0;
    this.countdown = CONFIG.COUNTDOWN_TIME;
    this._lastLabel = undefined;
    this.state = GameState.COUNTDOWN;

    this._emitStats();
    this._emitCountdown();
    this._ensureLoop();
  }

  stop() {
    this.running = false;
    this.paused = false;
    this.state = GameState.IDLE;
    this.input.setEnabled(false);
    this.hooks.onCountdown?.(null);
  }

  setPaused(paused) {
    // 결과 화면이나 카운트다운에서는 일시정지가 의미 없다.
    if (this.state !== GameState.PLAYING && paused) return;
    if (this.paused === paused) return;
    this.paused = paused;
    this.input.setEnabled(!paused && this.state === GameState.PLAYING);
    if (!paused) {
      // 복귀 순간 밀린 시간이 한꺼번에 흐르면 장애물에 박힌다.
      this.lastTime = performance.now();
      this.accumulator = 0;
    }
    this.hooks.onPause?.(paused);
  }

  stats() {
    const meters = this.world.meters;
    const coinPoints = this.coins * CONFIG.COIN_VALUE;
    return {
      meters,
      coins: this.coins,
      coinPoints,
      score: meters + coinPoints,
      elapsed: this.world.elapsed,
    };
  }

  // ── 내부 ────────────────────────────────────────────────

  _ensureLoop() {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    requestAnimationFrame(this._frame);
  }

  _frame(now) {
    if (!this.running) return;
    requestAnimationFrame(this._frame);

    // 탭 복귀 시 delta 폭주 방지
    const delta = Math.min((now - this.lastTime) / 1000, 0.25);
    this.lastTime = now;

    if (!this.paused) {
      this.accumulator += delta;
      while (this.accumulator >= FIXED_DT) {
        this._update(FIXED_DT);
        this.accumulator -= FIXED_DT;
      }
    }
    this._render();
  }

  _update(dt) {
    switch (this.state) {
      case GameState.COUNTDOWN: {
        this.countdown -= dt;
        this._emitCountdown();
        if (this.countdown <= 0) {
          this.state = GameState.PLAYING;
          this.input.setEnabled(true);
          this.hooks.onCountdown?.(null);
        }
        break;
      }

      case GameState.PLAYING: {
        this.input.update(dt);
        this.world.update(dt);
        this.spawner.update(dt, this.world);
        this.player.update(dt, this.input, (rect) => this.world.canStandAt(rect));

        this._collectCoins();
        if (anyHit(this.player.hitbox, this.world.obstacles)) this._die();

        this._emitStats();
        break;
      }

      case GameState.DYING: {
        this.deathTimer = Math.max(0, this.deathTimer - dt);
        const progress = 1 - this.deathTimer / CONFIG.DEATH_ANIM_TIME;
        this.shake = 14 * (1 - progress);
        this.fade = 0.45 * progress;
        if (this.deathTimer <= 0) {
          this.state = GameState.RESULT;
          this.hooks.onResult?.(this.stats());
        }
        break;
      }

      default:
        break;
    }
  }

  _collectCoins() {
    const box = this.player.hitbox;
    for (const coin of this.world.coins) {
      if (!coin.taken && aabb(box, coin)) {
        coin.taken = true;
        this.coins += 1;
      }
    }
  }

  _die() {
    this.player.kill();
    this.input.setEnabled(false);
    this.state = GameState.DYING;
    this.deathTimer = CONFIG.DEATH_ANIM_TIME;
    this.shake = 14;
  }

  _emitStats() {
    this.hooks.onStats?.(this.stats());
  }

  _emitCountdown() {
    const label = this._countdownLabel();
    if (label === this._lastLabel) return;
    this._lastLabel = label;
    this.hooks.onCountdown?.(label);
  }

  _countdownLabel() {
    if (this.countdown <= 0) return null;
    if (this.countdown <= 0.5) return 'GO!';
    return String(Math.ceil(this.countdown - 0.5));
  }

  _render() {
    this.renderer.draw({
      world: this.world,
      player: this.player,
      shake: this.shake,
      fade: this.fade,
    });
  }
}
