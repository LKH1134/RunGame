import { fetchLeaderboard } from '../firebase/scores.js';
import { getCurrentUser } from '../firebase/auth.js';

const el = (id) => document.getElementById(id);
const fmt = (n) => Number(n || 0).toLocaleString('ko-KR');

let nodes = {};

export function initLeaderboard() {
  nodes = {
    body: el('lb-body'),
    status: el('lb-status'),
    retry: el('lb-retry'),
    table: el('lb-table'),
  };
  nodes.retry.addEventListener('click', () => renderLeaderboard());
}

export async function renderLeaderboard() {
  setStatus('불러오는 중…', false);
  nodes.table.hidden = true;

  try {
    const rows = await fetchLeaderboard(100);
    const me = getCurrentUser();

    if (!rows.length) {
      setStatus('아직 기록이 없어요. 첫 주자가 되어 보세요!', false);
      return;
    }

    nodes.body.innerHTML = '';
    rows.forEach((row, i) => {
      const tr = document.createElement('tr');
      if (me && row.uid === me.uid) tr.classList.add('is-me');
      tr.innerHTML = `
        <td class="rank">${rankLabel(i + 1)}</td>
        <td class="name"></td>
        <td class="num strong">${fmt(row.bestScore)}</td>
        <td class="num">${fmt(row.meters)}m</td>
        <td class="num">${fmt(row.coins)}</td>
      `;
      // 아이디는 사용자 입력이므로 textContent로만 넣는다.
      tr.querySelector('.name').textContent = row.username;
      nodes.body.appendChild(tr);
    });

    nodes.table.hidden = false;
    setStatus('', false);
  } catch {
    setStatus('리더보드를 불러오지 못했어요.', true);
  }
}

function rankLabel(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return rank;
}

function setStatus(message, showRetry) {
  nodes.status.textContent = message;
  nodes.status.hidden = !message;
  nodes.retry.hidden = !showRetry;
}
