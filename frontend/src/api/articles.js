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

export async function fetchAllArticles(query = {}, pageSize = 200) {
  const normalizedPageSize = Math.max(1, Math.min(Number(pageSize) || 200, 200));
  let page = 1;
  let totalPages = 1;
  const items = [];

  do {
    const response = await fetchArticles({
      ...query,
      page,
      limit: normalizedPageSize,
    });

    if (Array.isArray(response.items) && response.items.length > 0) {
      items.push(...response.items);
    }

    totalPages = Math.max(1, Number(response?.meta?.totalPages) || 1);
    page += 1;
  } while (page <= totalPages);

  return {
    items,
    meta: {
      page: 1,
      limit: normalizedPageSize,
      total: items.length,
      totalPages,
    },
  };
}
