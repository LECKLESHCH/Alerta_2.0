import { apiGet } from './client';
import { API_ENDPOINTS } from './endpoints';

export async function startCrawl(scope) {
  const endpointMap = {
    all: API_ENDPOINTS.crawlAll(),
    sites: API_ENDPOINTS.crawlSites(),
    telegram: API_ENDPOINTS.crawlTelegram(),
    forums: API_ENDPOINTS.crawlForums(),
  };
  const endpoint = endpointMap[scope] || API_ENDPOINTS.crawlAll();

  return apiGet(endpoint);
}

export async function fetchCrawlStatus() {
  return apiGet(API_ENDPOINTS.crawlStatus());
}

export async function fetchCrawlLogs(limit = 200) {
  return apiGet(API_ENDPOINTS.crawlLogs(limit));
}
