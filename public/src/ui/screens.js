// 화면 표시 토글. 한 번에 하나의 섹션만 보인다.
export const SCREEN = {
  MENU: 'screen-menu',
  GAME: 'screen-game',
  LEADERBOARD: 'screen-leaderboard',
};

const ALL = Object.values(SCREEN);
let current = SCREEN.MENU;

export function show(screenId) {
  current = screenId;
  for (const id of ALL) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('is-active', id === screenId);
  }
}

export function currentScreen() {
  return current;
}
