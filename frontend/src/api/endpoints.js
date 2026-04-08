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
  crawlAll: () => buildUrl('/crawl/all'),
  crawlStatus: () => buildUrl('/crawl/status'),
  crawlArticle: () => buildUrl('/crawl/article'),
  threatPrediction: (articleId) =>
    buildUrl(`/threat-predictor/predict/${articleId}`),
};
