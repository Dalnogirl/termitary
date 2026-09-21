import { afterEach, describe, expect, it, vi } from 'vitest';

// env.ts resolves everything at import, so each case needs its own module
// instance. These branches only ever run under NODE_ENV=production, which until
// now no process had booted with.
const loadEnv = async (vars: Record<string, string | undefined>) => {
  vi.resetModules();
  for (const [key, value] of Object.entries(vars)) vi.stubEnv(key, value);
  return (await import('./env.js')).env;
};

const PRODUCTION = {
  NODE_ENV: 'production',
  BETTER_AUTH_SECRET: 'a-secret',
  GOOGLE_CLIENT_ID: 'g',
  GOOGLE_CLIENT_SECRET: 'g',
  GITHUB_CLIENT_ID: 'h',
  GITHUB_CLIENT_SECRET: 'h',
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('DATABASE_URL', () => {
  it('is required in production', async () => {
    await expect(loadEnv({ ...PRODUCTION, DATABASE_URL: undefined })).rejects.toThrow(
      /DATABASE_URL is required/,
    );
  });

  it('must be absolute in production', async () => {
    await expect(loadEnv({ ...PRODUCTION, DATABASE_URL: 'data/termitary.db' })).rejects.toThrow(
      /absolute path/,
    );
  });

  it('is taken as given when it is absolute', async () => {
    const env = await loadEnv({ ...PRODUCTION, DATABASE_URL: '/srv/termitary/termitary.db' });
    expect(env.databaseUrl).toBe('/srv/termitary/termitary.db');
  });

  it('falls back to a relative file in development', async () => {
    const env = await loadEnv({ NODE_ENV: 'development', DATABASE_URL: undefined });
    expect(env.databaseUrl).toBe('data/termitary.db');
  });

  it('falls back to memory under test', async () => {
    const env = await loadEnv({ NODE_ENV: 'test', DATABASE_URL: undefined });
    expect(env.databaseUrl).toBe(':memory:');
  });
});

describe('production secrets', () => {
  it('refuses the dev fallback secret', async () => {
    await expect(
      loadEnv({ ...PRODUCTION, BETTER_AUTH_SECRET: undefined, DATABASE_URL: '/srv/t.db' }),
    ).rejects.toThrow(/BETTER_AUTH_SECRET is required/);
  });

  it('refuses to boot without a social provider', async () => {
    await expect(
      loadEnv({
        ...PRODUCTION,
        GITHUB_CLIENT_ID: undefined,
        GITHUB_CLIENT_SECRET: undefined,
        DATABASE_URL: '/srv/t.db',
      }),
    ).rejects.toThrow(/required in production/);
  });
});
