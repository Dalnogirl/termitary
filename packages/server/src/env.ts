const port = Number(process.env.PORT ?? 3001);
const host = process.env.HOST ?? '127.0.0.1';
const nodeEnv = process.env.NODE_ENV ?? 'development';

const resolveAuthSecret = (): string => {
  const fromEnv = process.env.BETTER_AUTH_SECRET;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (nodeEnv === 'production') {
    throw new Error(
      'BETTER_AUTH_SECRET is required in production. Refusing to boot with the dev fallback secret.',
    );
  }
  return 'dev-only-insecure-secret-rotate-me';
};

export const env = {
  port,
  host,
  nodeEnv,
  // Phase-6 forward-compat: ':memory:' default for tests dies when prod swaps
  // to Postgres (SQLite/PG dialect drift = same class of bug as DB mocks).
  // Phase 6 replaces with testcontainers-pg / pglite via a vitest setup file;
  // buildApp({ db? }) shape stays.
  databaseUrl: process.env.DATABASE_URL ?? (nodeEnv === 'test' ? ':memory:' : 'data/hive.db'),
  authSecret: resolveAuthSecret(),
  // Browser-facing origin, deliberately not `host`: we bind 127.0.0.1 but the
  // web client hits localhost, and a session cookie set on one is never sent
  // to the other. better-auth's origin check compares against this too.
  authBaseUrl: process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`,
  webOrigin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
} as const;
