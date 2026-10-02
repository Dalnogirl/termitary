export const messageOf = (error: unknown, fallback = 'unknown error'): string =>
  error instanceof Error ? error.message : fallback;
