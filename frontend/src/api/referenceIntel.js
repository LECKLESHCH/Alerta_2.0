import { apiGet } from './client';
import { API_ENDPOINTS } from './endpoints';

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    searchParams.set(key, String(value));
  });

  return searchParams.toString();
}

export async function fetchReferenceCves(params = {}) {
  const query = buildQuery(params);
  const url = query
    ? `${API_ENDPOINTS.referenceCves()}?${query}`
    : API_ENDPOINTS.referenceCves();
  return apiGet(url);
}
