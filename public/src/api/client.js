// Worker API 호출 래퍼.
// 프런트와 API가 같은 오리진(같은 Worker)에서 서빙되므로 baseURL이 없다.

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      // 세션 쿠키를 주고받아야 한다. 같은 오리진이라 same-origin으로 충분하다.
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError('network', '네트워크에 연결할 수 없습니다.', 0);
  }

  let data = null;
  try {
    data = await response.json();
  } catch {
    /* 본문이 없거나 JSON이 아닌 경우 */
  }

  if (!response.ok) {
    throw new ApiError(
      data?.error || 'unknown',
      data?.message || '문제가 발생했어요. 잠시 후 다시 시도해 주세요.',
      response.status
    );
  }

  return data;
}
