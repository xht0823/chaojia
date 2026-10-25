export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function api(path, { body, ...options } = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      method: body === undefined ? 'GET' : 'POST',
      credentials: 'same-origin',
      cache: 'no-store',
      headers: body === undefined ? {} : { 'Content-Type': 'application/json', 'X-Chaowan-Client': 'web' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'NETWORK_ERROR', '连接失败，请检查网络或稍后重试');
  }
  let data;
  try { data = await response.json(); } catch { data = {}; }
  if (!response.ok) {
    const detail = data.detail || data;
    throw new ApiError(response.status, detail.code, detail.error || '请求失败，请稍后重试');
  }
  return data;
}
