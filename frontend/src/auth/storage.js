const ACCESS_TOKEN_KEY = 'alerta_access_token';
const USER_KEY = 'alerta_user';

function canUseStorage() {
  return (
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  );
}

export function getAccessToken() {
  if (!canUseStorage()) {
    return '';
  }

  return window.localStorage.getItem(ACCESS_TOKEN_KEY) || '';
}

export function getStoredUser() {
  if (!canUseStorage()) {
    return null;
  }

  const rawValue = window.localStorage.getItem(USER_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch (error) {
    clearAuthSession();
    return null;
  }
}

export function setAuthSession({ accessToken, user }) {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuthSession() {
  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export function isAuthenticated() {
  return Boolean(getAccessToken());
}

