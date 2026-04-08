const runtimeHost =
  typeof window !== 'undefined' && window.location?.hostname
    ? window.location.hostname
    : '127.0.0.1';
const runtimeProtocol =
  typeof window !== 'undefined' && window.location?.protocol
    ? window.location.protocol
    : 'http:';

export const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL ||
  `${runtimeProtocol}//${runtimeHost}:3000`;
