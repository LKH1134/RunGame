import { CONFIG } from './config.js';

// 키 상태와 조작감 타이머(점프 버퍼)를 관리한다.
// 코요테 타임은 "지면에 있었는지"에 대한 상태라 player.js가 갖는다.
export class Input {
  constructor() {
    this.jumpBuffer = 0; // 남은 버퍼 시간 (s)
    this.slideHeld = false;
    this.enabled = false;

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
  }

  attach(target = window) {
    this._target = target;
    target.addEventListener('keydown', this._onKeyDown);
    target.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    if (!this._target) return;
    this._target.removeEventListener('keydown', this._onKeyDown);
    this._target.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this._target = null;
  }

  /** 카운트다운/결과 화면에서는 입력을 막는다. */
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.reset();
  }

  reset() {
    this.jumpBuffer = 0;
    this.slideHeld = false;
  }

  update(dt) {
    if (this.jumpBuffer > 0) this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
  }

  get jumpBuffered() {
    return this.jumpBuffer > 0;
  }

  consumeJump() {
    this.jumpBuffer = 0;
  }

  _isJumpKey(code) {
    return code === 'Space' || code === 'ArrowUp' || code === 'KeyW';
  }

  _isSlideKey(code) {
    return (
      code === 'ShiftLeft' ||
      code === 'ShiftRight' ||
      code === 'ArrowDown' ||
      code === 'KeyS'
    );
  }

  /** 입력창·버튼에 포커스가 있으면 기본 동작을 막지 않는다. */
  _isFormControl(target) {
    if (!target || !target.tagName) return false;
    return (
      ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON'].includes(target.tagName) ||
      target.isContentEditable
    );
  }

  _onKeyDown(e) {
    // 스페이스/방향키의 스크롤 기본 동작은 게임 중이 아니어도 거슬린다.
    if (
      (this._isJumpKey(e.code) || this._isSlideKey(e.code)) &&
      !this._isFormControl(e.target)
    ) {
      e.preventDefault();
    }
    if (!this.enabled) return;

    if (this._isJumpKey(e.code)) {
      // 키 리피트는 버퍼를 계속 채워 "누르고 있으면 계속 점프"가 되므로 무시한다.
      if (!e.repeat) this.jumpBuffer = CONFIG.JUMP_BUFFER_TIME;
    } else if (this._isSlideKey(e.code)) {
      this.slideHeld = true;
    }
  }

  _onKeyUp(e) {
    if (!this.enabled) return;
    if (this._isSlideKey(e.code)) this.slideHeld = false;
  }

  _onBlur() {
    // 탭이 바뀌면 keyup을 못 받아 키가 눌린 채로 남는다.
    this.reset();
  }
}
