const defaultApiBaseUrl = "http://localhost:8080";
const defaultWsBaseUrl = "ws://localhost:8080";

export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || defaultApiBaseUrl,
  wsBaseUrl: import.meta.env.VITE_WS_BASE_URL || defaultWsBaseUrl,
};
