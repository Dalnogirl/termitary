import { isAbsolute } from 'node:path';
import type { AuthProviderId } from '@termitary/protocol';

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

// Under a process supervisor the working directory is whatever the unit file
// says, so a relative path resolves somewhere unintended and SQLite creates an
// empty database there without complaining. Every restart, a fresh one.
const resolveDatabaseUrl = (): string => {
  const fromEnv = process.env.DATABASE_URL;
  if (nodeEnv !== 'production') {
    if (fromEnv !== undefined && fromEnv.length > 0) return fromEnv;
    return nodeEnv === 'test' ? ':memory:' : 'data/termitary.db';
  }
  if (fromEnv === undefined || fromEnv.length === 0) {
    throw new Error('DATABASE_URL is required in production. Refusing to boot without it.');
  }
  if (!isAbsolute(fromEnv)) {
    throw new Error(
      `DATABASE_URL must be an absolute path in production. Refusing to boot with '${fromEnv}'.`,
    );
  }
  return fromEnv;
};

export type SocialProviderCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type SocialProviders = Readonly<Partial<Record<AuthProviderId, SocialProviderCredentials>>>;

const SOCIAL_PROVIDER_VARS = {
  google: ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'],
  github: ['GITHUB_CLIENT_ID', 'GITHUB_CLIENT_SECRET'],
} as const satisfies Record<AuthProviderId, readonly [string, string]>;

const entriesOf = <T extends object>(o: T): [keyof T, T[keyof T]][] =>
  Object.entries(o) as [keyof T, T[keyof T]][];

// Production requires both pairs and refuses to boot without them: the email
// OTP behind them has no working delivery yet, so a deployment missing a
// provider is one most players cannot sign in to at all. Development registers
// whatever it has credentials for, so a fresh clone still runs `pnpm dev` on
// OTP alone. Half a pair is a typo in either environment, never a configuration.
const resolveSocialProviders = (): SocialProviders => {
  const configured: { -readonly [K in AuthProviderId]?: SocialProviderCredentials } = {};
  for (const [provider, [idVar, secretVar]] of entriesOf(SOCIAL_PROVIDER_VARS)) {
    const clientId = process.env[idVar] ?? '';
    const clientSecret = process.env[secretVar] ?? '';
    if (clientId.length > 0 && clientSecret.length > 0) {
      configured[provider] = { clientId, clientSecret };
      continue;
    }
    if (clientId.length > 0 || clientSecret.length > 0) {
      throw new Error(
        `${idVar} and ${secretVar} must be set together. Refusing to boot with half of a provider.`,
      );
    }
    if (nodeEnv === 'production') {
      throw new Error(
        `${idVar} and ${secretVar} are required in production. Refusing to boot without ${provider} sign-in.`,
      );
    }
  }
  return configured;
};

export const env = {
  port,
  host,
  nodeEnv,
  // Phase-6 forward-compat: ':memory:' default for tests dies when prod swaps
  // to Postgres (SQLite/PG dialect drift = same class of bug as DB mocks).
  // Phase 6 replaces with testcontainers-pg / pglite via a vitest setup file;
  // buildApp({ db? }) shape stays.
  databaseUrl: resolveDatabaseUrl(),
  authSecret: resolveAuthSecret(),
  // Browser-facing origin, deliberately not `host`: we bind 127.0.0.1 but the
  // web client hits localhost, and a session cookie set on one is never sent
  // to the other. Every OAuth callback hangs off it too.
  authBaseUrl: process.env.BETTER_AUTH_URL ?? `http://localhost:${port}`,
  // OAuth returns the browser to `authBaseUrl`, and in development that is not
  // the page the player left: better-auth refuses to redirect on to vite
  // unless its origin is trusted.
  trustedOrigins: nodeEnv === 'production' ? [] : ['http://localhost:5173'],
  roomSweepIntervalMs: Number(process.env.ROOM_SWEEP_INTERVAL_MS ?? 60 * 60 * 1000),
  socialProviders: resolveSocialProviders(),
} as const;
