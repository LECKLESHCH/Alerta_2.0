import { apiGet } from './client';
import { API_ENDPOINTS } from './endpoints';

function toQueryString(query = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }
    searchParams.set(key, String(value));
  });

  return searchParams.toString();
}

export async function fetchArticles(query = {}) {
  const qs = toQueryString(query);
  const url = qs
    ? `${API_ENDPOINTS.articles()}?${qs}`
    : API_ENDPOINTS.articles();

  const payload = await apiGet(url);

  if (Array.isArray(payload)) {
    return {
      items: payload,
      meta: null,
    };
  }

  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    meta: payload?.meta || null,
  };
}
