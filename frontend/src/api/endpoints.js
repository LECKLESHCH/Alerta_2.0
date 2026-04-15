import { API_BASE_URL } from './config';

function buildUrl(path) {
  return `${API_BASE_URL}${path}`;
}

export const API_ENDPOINTS = {
  health: () => buildUrl('/'),
  login: () => buildUrl('/auth/login'),
  register: () => buildUrl('/auth/register'),
  me: () => buildUrl('/auth/me'),
  articles: () => buildUrl('/articles'),
  objects: () => buildUrl('/objects'),
  objectById: (objectId) => buildUrl(`/objects/${objectId}`),
  crawlAll: () => buildUrl('/crawl/all'),
  crawlSites: () => buildUrl('/crawl/sites'),
  crawlStatus: () => buildUrl('/crawl/status'),
  crawlLogs: (limit = 200) => buildUrl(`/crawl/logs?limit=${limit}`),
  crawlArticle: () => buildUrl('/crawl/article'),
  threatPrediction: (articleId) =>
    buildUrl(`/threat-predictor/predict/${articleId}`),
};
