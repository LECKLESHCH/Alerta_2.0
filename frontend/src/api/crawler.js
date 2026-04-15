import { apiGet } from './client';
import { API_ENDPOINTS } from './endpoints';

export async function startCrawl(scope) {
  const endpoint =
    scope === 'sites' ? API_ENDPOINTS.crawlSites() : API_ENDPOINTS.crawlAll();

  return apiGet(endpoint);
}

export async function fetchCrawlStatus() {
  return apiGet(API_ENDPOINTS.crawlStatus());
}

export async function fetchCrawlLogs(limit = 200) {
  return apiGet(API_ENDPOINTS.crawlLogs(limit));
}
