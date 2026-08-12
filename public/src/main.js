import { CONFIG } from './game/config.js';
import { Game } from './game/game.js';
import { SCREEN, show, currentScreen } from './ui/screens.js';
import * as hud from './ui/hud.js';
import { initAuthModal, openAuthModal, isAuthModalOpen } from './ui/authModal.js';
import { initLeaderboard, renderLeaderboard } from './ui/leaderboard.js';
import { onUserChanged, getCurrentUser, signOut } from './api/auth.js';
import { submitScore } from './api/scores.js';

const el = (id) => document.getElementById(id);

let game;
let leaderboardReturn = SCREEN.MENU;

function boot() {
  hud.initHud();
  initAuthModal();
  initLeaderboard();

  game = new Game(el('canvas'), {
    onCountdown: hud.setCountdown,
    onStats: hud.setStats,
    onResult: handleResult,
    onPause: hud.setPaused,
  });

  wireMenu();
  wireResult();
  wireLeaderboard();
  wirePause();

  onUserChanged(renderUserState);
  show(SCREEN.MENU);

  // 콘솔에서 수치를 실시간으로 만지며 난이도를 조정하기 위한 노출.
  // 예) CONFIG.SPEED_ACCEL = 12
  window.CONFIG = CONFIG;
  window.game = game;
}

// ── 화면 전환 ────────────────────────────────────────────

function startGame() {
  show(SCREEN.GAME);
  hud.hideResult();
  hud.resetStats();
  game.start();
}

function goMenu() {
  game.stop();
  hud.hideResult();
  hud.setPaused(false);
  show(SCREEN.MENU);
}

function openLeaderboard(from) {
  leaderboardReturn = from;
  show(SCREEN.LEADERBOARD);
  renderLeaderboard();
}

// ── 결과 정산 ────────────────────────────────────────────

async function handleResult(stats) {
  hud.showResult(stats);

  // 비로그인도 플레이는 허용하되, 저장은 건너뛰고 로그인을 유도한다.
  if (!getCurrentUser()) {
    hud.setSaveState('anonymous');
    return;
  }

  hud.setSaveState('saving');
  try {
    const result = await submitScore({
      score: stats.score,
      coins: stats.coins,
      meters: stats.meters,
    });
    if (!result.saved) hud.setSaveState('anonymous');
    else hud.setSaveState(result.isBest ? 'best' : 'saved');
  } catch (err) {
    // 세션이 만료된 경우가 가장 흔하다 — 로그인 상태 표시도 되돌린다.
    if (err?.status === 401) {
      await signOut();
      hud.setSaveState('anonymous');
      return;
    }
    hud.setSaveState('error', err?.message || '기록 저장에 실패했어요.');
  }
}

// ── 배선 ─────────────────────────────────────────────────

function wireMenu() {
  el('btn-play').addEventListener('click', startGame);
  el('btn-leaderboard').addEventListener('click', () => openLeaderboard(SCREEN.MENU));
  el('btn-auth').addEventListener('click', () => {
    if (getCurrentUser()) signOut();
    else openAuthModal('signin');
  });
}

function wireResult() {
  el('result-retry').addEventListener('click', startGame);
  el('result-board').addEventListener('click', () => openLeaderboard(SCREEN.GAME));
  el('result-menu').addEventListener('click', goMenu);
}

function wireLeaderboard() {
  el('lb-back').addEventListener('click', () => {
    show(leaderboardReturn);
    // 결과 화면에서 왔다면 결과 패널이 그대로 남아 있어야 한다.
  });
}

function wirePause() {
  // 탭을 벗어난 사이 시간이 흐르면 복귀 순간 장애물에 박힌다.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game?.setPaused(true);
  });

  // 자동 재개는 오히려 당황스럽다. 사용자가 신호를 줄 때 재개한다.
  const resume = () => {
    if (game?.paused) game.setPaused(false);
  };
  el('paused').addEventListener('pointerdown', resume);
  window.addEventListener('keydown', () => {
    if (game?.paused && !isAuthModalOpen()) resume();
  });

  // 모달이 열리면 게임을 멈춘다 (입력이 폼으로 가야 하므로).
  const modal = el('auth-modal');
  new MutationObserver(() => {
    if (!modal.hidden) game?.setPaused(true);
  }).observe(modal, { attributes: true, attributeFilter: ['hidden'] });
}

function renderUserState(user) {
  const authButton = el('btn-auth');
  const line = el('menu-user');

  if (user) {
    authButton.textContent = '로그아웃';
    line.hidden = false;
    line.innerHTML = '';
    const b = document.createElement('b');
    b.textContent = user.username; // 사용자 입력 — textContent로만
    line.append(b, document.createTextNode(' 님으로 로그인 중'));
  } else {
    authButton.textContent = '로그인';
    line.hidden = true;
  }

  // 리더보드를 보는 중에 로그인 상태가 바뀌면 내 행 하이라이트를 갱신한다.
  if (currentScreen() === SCREEN.LEADERBOARD) renderLeaderboard();
}

boot();
