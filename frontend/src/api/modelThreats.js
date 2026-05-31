import { apiGet, apiPost } from './client';
import { API_ENDPOINTS } from './endpoints';

function withCollection(item, collection) {
  return {
    ...item,
    _id: item._id || `${collection}:${item.article_id || item.url || Math.random()}`,
    type: 'threat',
    dbCollection: collection,
    text: item.threat_summary || item.reasoning || '',
    interpretation_summary: item.reasoning || item.threat_summary || '',
    llm_confidence: Number(item.llm_confidence || 0),
  };
}

export async function fetchModelThreats(source) {
  const items = await apiGet(API_ENDPOINTS.modelThreatsBySource(source));
  const collection =
    source === 'tg' ? 'model_threat_tg' : source === 'forum' ? 'model_threat_forum' : 'model_threat_web';
  return Array.isArray(items) ? items.map((item) => withCollection(item, collection)) : [];
}

export async function fetchAllModelThreats() {
  const [web, tg, forum] = await Promise.all([
    fetchModelThreats('web'),
    fetchModelThreats('tg'),
    fetchModelThreats('forum'),
  ]);
  return [
    ...(Array.isArray(web) ? web : []),
    ...(Array.isArray(tg) ? tg : []),
    ...(Array.isArray(forum) ? forum : []),
  ].sort((left, right) => {
    const leftDate = new Date(left.publishedAt || 0).getTime();
    const rightDate = new Date(right.publishedAt || 0).getTime();
    return rightDate - leftDate;
  });
}

export async function rebuildModelThreatsBySource(source, limit = 150) {
  return apiPost(API_ENDPOINTS.rebuildModelThreatsBySource(source, limit), {});
}

export async function rebuildModelThreatsAll(limit = 150) {
  return apiPost(API_ENDPOINTS.rebuildModelThreatsAll(limit), {});
}
