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
  modelObjects: () => buildUrl('/model-objects'),
  modelObjectById: (objectId) => buildUrl(`/model-objects/${objectId}`),
  seedModelObjects: () => buildUrl('/model-objects/seed-defaults'),
  modelThreatsBySource: (source) => buildUrl(`/model-threats/${source}`),
  rebuildModelThreatsBySource: (source, limit = 150) =>
    buildUrl(`/model-threats/rebuild/${source}?limit=${limit}`),
  rebuildModelThreatsAll: (limit = 150) =>
    buildUrl(`/model-threats/rebuild-all?limit=${limit}`),
  crawlAll: () => buildUrl('/crawl/all'),
  crawlSites: () => buildUrl('/crawl/sites'),
  crawlTelegram: () => buildUrl('/crawl/telegram'),
  crawlForums: () => buildUrl('/crawl/forums'),
  crawlStatus: () => buildUrl('/crawl/status'),
  crawlLogs: (limit = 200) => buildUrl(`/crawl/logs?limit=${limit}`),
  crawlArticle: () => buildUrl('/crawl/article'),
  threatPrediction: (articleId) =>
    buildUrl(`/threat-predictor/predict/${articleId}`),
  referenceCves: () => buildUrl('/reference-intel/cves'),
};
