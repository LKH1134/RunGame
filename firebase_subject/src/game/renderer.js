import { CONFIG, OBSTACLE } from './config.js';
import { PlayerState } from './player.js';

// 모든 draw 호출은 이 파일에만 있다.
// 도형 프로토타입 → 스프라이트로 교체할 때 여기만 고치면 되도록,
// 나머지 모듈은 ctx를 절대 만지지 않는다.
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
  }

  draw({ world, player, shake = 0, fade = 0 }) {
    const ctx = this.ctx;
    const { VIEW_W, VIEW_H, GROUND_Y } = CONFIG;

    ctx.save();
    ctx.clearRect(0, 0, VIEW_W, VIEW_H);

    if (shake > 0) {
      ctx.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake
      );
    }

    this._drawSky(ctx);
    this._drawParallax(ctx, world.traveled);
    this._drawGround(ctx, world.traveled);

    for (const o of world.obstacles) this._drawObstacle(ctx, o);
    for (const c of world.coins) this._drawCoin(ctx, c, world.elapsed);

    this._drawPlayer(ctx, player);

    ctx.restore();

    if (fade > 0) {
      ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
  }

  _drawSky(ctx) {
    const { VIEW_W, VIEW_H } = CONFIG;
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#1b2540');
    g.addColorStop(0.55, '#35406b');
    g.addColorStop(1, '#6a5c86');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    // 달
    ctx.fillStyle = 'rgba(255, 247, 214, 0.9)';
    ctx.beginPath();
    ctx.arc(790, 96, 34, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawParallax(ctx, traveled) {
    const { GROUND_Y } = CONFIG;

    // 먼 언덕 (0.15배 속도)
    ctx.fillStyle = '#2a3357';
    this._repeatingHills(ctx, traveled * 0.15, 320, 110, GROUND_Y + 10);

    // 가까운 언덕 (0.4배 속도)
    ctx.fillStyle = '#232b4a';
    this._repeatingHills(ctx, traveled * 0.4, 210, 70, GROUND_Y + 10);
  }

  _repeatingHills(ctx, offset, period, height, baseY) {
    const { VIEW_W } = CONFIG;
    const start = -(offset % period) - period;
    ctx.beginPath();
    ctx.moveTo(start, baseY);
    for (let x = start; x < VIEW_W + period; x += period) {
      ctx.quadraticCurveTo(x + period / 2, baseY - height, x + period, baseY);
    }
    ctx.lineTo(VIEW_W + period, baseY);
    ctx.lineTo(start, baseY);
    ctx.closePath();
    ctx.fill();
  }

  _drawGround(ctx, traveled) {
    const { VIEW_W, VIEW_H, GROUND_Y } = CONFIG;

    ctx.fillStyle = '#171c2e';
    ctx.fillRect(0, GROUND_Y, VIEW_W, VIEW_H - GROUND_Y);

    ctx.fillStyle = '#4de0c8';
    ctx.fillRect(0, GROUND_Y - 3, VIEW_W, 3);

    // 스크롤되는 바닥 줄무늬 — 속도감의 주된 단서다.
    ctx.fillStyle = 'rgba(77, 224, 200, 0.18)';
    const period = 80;
    const offset = traveled % period;
    for (let x = -offset; x < VIEW_W; x += period) {
      ctx.fillRect(x, GROUND_Y + 16, 40, 4);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    const period2 = 140;
    const offset2 = (traveled * 0.6) % period2;
    for (let x = -offset2; x < VIEW_W; x += period2) {
      ctx.fillRect(x, GROUND_Y + 42, 70, 3);
    }
  }

  _drawObstacle(ctx, o) {
    if (o.type === OBSTACLE.GROUND_BLOCK) {
      ctx.fillStyle = '#e8574a';
      this._roundRect(ctx, o.x, o.y, o.w, o.h, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.fillRect(o.x, o.y, o.w, 5);
    } else {
      ctx.fillStyle = '#f0a63c';
      this._roundRect(ctx, o.x, o.y, o.w, o.h, 4);
      ctx.fill();
      // 경고용 빗금
      ctx.save();
      ctx.beginPath();
      ctx.rect(o.x, o.y, o.w, o.h);
      ctx.clip();
      ctx.strokeStyle = 'rgba(40, 30, 10, 0.45)';
      ctx.lineWidth = 7;
      for (let i = -o.h; i < o.w; i += 16) {
        ctx.beginPath();
        ctx.moveTo(o.x + i, o.y + o.h);
        ctx.lineTo(o.x + i + o.h, o.y);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  _drawCoin(ctx, c, time) {
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2;
    const r = c.w / 2;
    // 회전하는 것처럼 보이도록 가로 폭만 진동시킨다.
    const squash = Math.abs(Math.cos(time * 4 + c.x * 0.01)) * 0.75 + 0.25;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(squash, 1);
    ctx.fillStyle = '#ffd45e';
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#c9962a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  _drawPlayer(ctx, player) {
    const b = player.bounds;
    const dead = player.state === PlayerState.DEAD;
    const sliding = player.state === PlayerState.SLIDE;

    ctx.save();
    if (dead) ctx.globalAlpha = 0.65;

    // 몸통
    ctx.fillStyle = dead ? '#8a8fa6' : '#4de0c8';
    this._roundRect(ctx, b.x, b.y, b.w, b.h, sliding ? 12 : 8);
    ctx.fill();

    // 다리 — 지상에서만 움직인다.
    if (!sliding) {
      const swing = player.grounded ? Math.sin(player.runCycle) * 7 : 4;
      ctx.fillStyle = dead ? '#6f748a' : '#2fae9c';
      ctx.fillRect(b.x + 6, b.y + b.h - 4, 10, 8 + swing);
      ctx.fillRect(b.x + b.w - 16, b.y + b.h - 4, 10, 8 - swing);
    }

    // 눈 — 진행 방향(오른쪽)을 본다.
    ctx.fillStyle = '#12172a';
    const eyeY = b.y + (sliding ? 10 : 18);
    ctx.fillRect(b.x + b.w - 15, eyeY, 6, 6);

    ctx.restore();
  }

  _roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }
}
