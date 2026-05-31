import { apiDelete, apiGet, apiPatch, apiPost } from './client';
import { API_ENDPOINTS } from './endpoints';

export async function createObjectPassport(payload) {
  return apiPost(API_ENDPOINTS.modelObjects(), payload);
}

export async function fetchObjects() {
  return apiGet(API_ENDPOINTS.modelObjects());
}

export async function deleteObjectPassport(objectId) {
  return apiDelete(API_ENDPOINTS.modelObjectById(objectId));
}

export async function seedDefaultObjectModels() {
  return apiPost(API_ENDPOINTS.seedModelObjects(), {});
}

export async function updateObjectPassport(objectId, payload) {
  return apiPatch(API_ENDPOINTS.modelObjectById(objectId), payload);
}
