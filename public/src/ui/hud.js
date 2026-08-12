const el = (id) => document.getElementById(id);
const fmt = (n) => n.toLocaleString('ko-KR');

let nodes = {};
let last = { meters: -1, coins: -1, score: -1 };

export function initHud() {
  nodes = {
    meters: el('hud-meters'),
    coins: el('hud-coins'),
    score: el('hud-score'),
    countdown: el('countdown'),
    countdownText: el('countdown-text'),
    paused: el('paused'),
    result: el('result'),
    resultScore: el('result-score'),
    resultBreakdown: el('result-breakdown'),
    resultBest: el('result-best'),
    resultSave: el('result-save'),
  };
}

/** 매 프레임 호출되므로 값이 바뀐 항목만 DOM에 쓴다. */
export function setStats({ meters, coins, score }) {
  if (meters !== last.meters) {
    nodes.meters.textContent = fmt(meters);
    last.meters = meters;
  }
  if (coins !== last.coins) {
    nodes.coins.textContent = fmt(coins);
    last.coins = coins;
  }
  if (score !== last.score) {
    nodes.score.textContent = fmt(score);
    last.score = score;
  }
}

export function resetStats() {
  last = { meters: -1, coins: -1, score: -1 };
  setStats({ meters: 0, coins: 0, score: 0 });
}

export function setCountdown(label) {
  if (!label) {
    nodes.countdown.hidden = true;
    return;
  }
  nodes.countdown.hidden = false;
  nodes.countdownText.textContent = label;
  // 매 숫자마다 팝 애니메이션을 다시 재생시킨다.
  nodes.countdownText.classList.remove('pop');
  void nodes.countdownText.offsetWidth;
  nodes.countdownText.classList.add('pop');
}

export function setPaused(paused) {
  nodes.paused.hidden = !paused;
}

export function showResult({ meters, coins, coinPoints, score }) {
  nodes.result.hidden = false;
  nodes.resultScore.textContent = fmt(score);
  // 점수가 어디서 왔는지 보이면 다음 판의 플레이 방식이 달라진다.
  nodes.resultBreakdown.textContent =
    `거리 ${fmt(meters)}m + 동전 ${fmt(coins)}개(${fmt(coinPoints)}) = ${fmt(score)}점`;
  nodes.resultBest.hidden = true;
  setSaveState('idle');
}

export function hideResult() {
  nodes.result.hidden = true;
}

/**
 * @param {'idle'|'saving'|'saved'|'best'|'error'|'anonymous'} state
 */
export function setSaveState(state, detail = '') {
  const save = nodes.resultSave;
  const best = nodes.resultBest;
  save.className = 'result-save';
  best.hidden = true;

  switch (state) {
    case 'saving':
      save.textContent = '기록을 저장하는 중…';
      break;
    case 'saved':
      save.textContent = '기록을 저장했어요.';
      save.classList.add('ok');
      break;
    case 'best':
      save.textContent = '기록을 저장했어요.';
      save.classList.add('ok');
      best.hidden = false;
      best.textContent = '최고 기록 갱신!';
      break;
    case 'anonymous':
      save.textContent = '기록을 저장하려면 로그인하세요.';
      save.classList.add('warn');
      break;
    case 'error':
      save.textContent = detail || '기록 저장에 실패했어요.';
      save.classList.add('error');
      break;
    default:
      save.textContent = '';
  }
}
