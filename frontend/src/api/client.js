import { clearAuthSession, getAccessToken } from '../auth/storage';

async function readJsonResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  const text = await response.text();
  return text ? { message: text } : null;
}

async function request(url, options = {}) {
  const token = getAccessToken();
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const payload = await readJsonResponse(response);

  if (response.status === 401) {
    clearAuthSession();
    if (typeof window !== 'undefined') {
      const loginPath = '/user-pages/login-1';
      const currentPath = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (window.location.pathname !== loginPath) {
        const nextUrl = `${loginPath}?next=${encodeURIComponent(currentPath)}`;
        window.location.assign(nextUrl);
      }
    }
  }

  if (!response.ok) {
    const message =
      (payload && typeof payload.message === 'string' && payload.message) ||
      (payload && typeof payload.error === 'string' && payload.error) ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

export async function apiGet(url) {
  return request(url, { method: 'GET' });
}

export async function apiPost(url, payload = {}) {
  return request(url, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function apiDelete(url) {
  return request(url, { method: 'DELETE' });
}
