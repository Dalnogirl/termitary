const STORAGE_KEY = 'hive-player-id';

const readStored = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

const writeStored = (value: string): void => {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // Safari private mode and storage-disabled configs throw on setItem.
    // Falling back to a session-only id keeps the app functional.
  }
};

export const getOrCreatePlayerId = (): string => {
  const stored = readStored();
  if (stored !== null && stored.length > 0) return stored;
  const fresh = crypto.randomUUID();
  writeStored(fresh);
  return fresh;
};

export const clearPlayerId = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore — see writeStored
  }
};
