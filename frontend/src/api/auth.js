import { apiGet, apiPost } from './client';
import { API_ENDPOINTS } from './endpoints';

export function login(payload) {
  return apiPost(API_ENDPOINTS.login(), payload);
}

export function register(payload) {
  return apiPost(API_ENDPOINTS.register(), payload);
}

export function fetchCurrentUser() {
  return apiGet(API_ENDPOINTS.me());
}

