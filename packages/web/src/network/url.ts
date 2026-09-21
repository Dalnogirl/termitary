// The API serves the bundle in production and vite proxies it in development,
// so both halves are one origin and the default is wherever the page came from.
// The overrides are for a client pointed at a server somewhere else; each one
// is a full base, `/api` and all.
export const getWsUrl = (): string => {
  const fromEnv = import.meta.env.VITE_TERMITARY_WS_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return `${window.location.origin.replace(/^http/, 'ws')}/ws`;
};

export const getApiUrl = (): string => {
  const fromEnv = import.meta.env.VITE_TERMITARY_API_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return `${window.location.origin}/api`;
};
