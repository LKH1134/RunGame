// AABB(축 정렬 사각형) 교차만 사용한다. 원형·픽셀 판정은 불필요.
// 사각형은 모두 { x, y, w, h } 이며 (x, y)는 좌상단이다.

export function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function anyHit(rect, list) {
  for (const item of list) {
    if (aabb(rect, item)) return item;
  }
  return null;
}
