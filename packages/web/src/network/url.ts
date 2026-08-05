export const getWsUrl = (): string => {
  const fromEnv = import.meta.env.VITE_HIVE_WS_URL;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return 'ws://localhost:3001/ws';
};
