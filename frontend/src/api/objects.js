import { apiDelete, apiGet, apiPost } from './client';
import { API_ENDPOINTS } from './endpoints';

export async function createObjectPassport(payload) {
  return apiPost(API_ENDPOINTS.objects(), payload);
}

export async function fetchObjects() {
  return apiGet(API_ENDPOINTS.objects());
}

export async function deleteObjectPassport(objectId) {
  return apiDelete(API_ENDPOINTS.objectById(objectId));
}
