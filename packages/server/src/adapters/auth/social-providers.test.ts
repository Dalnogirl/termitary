// The first leg of OAuth only: `POST /api/auth/sign-in/social` answers with
// JSON, so app.inject reaches it. The callback leg is a browser redirect chain
// through a third party and is not covered here. Manual recipe:
//   GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... pnpm --filter @termitary/server dev
//   open http://localhost:5173/signin, click Google, sign in
//   # lands back on the lobby with better-auth.session_token set
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import type { SocialProviders } from '../../env.js';
import { silentLog } from '../../testing/stores.js';
import { type DbHandle, createDb } from '../db/client.js';
import { createDrizzleUserStore } from '../drizzle-user-store.js';
import { createAuth } from './better-auth.js';

const CREDENTIALS = {
  google: { clientId: 'google-test-id', clientSecret: 'google-test-secret' },
  github: { clientId: 'github-test-id', clientSecret: 'github-test-secret' },
} as const;

const AUTHORIZE_HOST: Record<keyof typeof CREDENTIALS, string> = {
  google: 'accounts.google.com',
  github: 'github.com',
};

describe('social sign-in', () => {
  let app: FastifyInstance;
  let dbHandle: DbHandle;

  const buildWith = async (socialProviders: SocialProviders): Promise<void> => {
    dbHandle = createDb(':memory:');
    const auth = createAuth(dbHandle.db, createDrizzleUserStore(dbHandle.db), silentLog, {
      socialProviders,
      sendOtp: async () => {},
    });
    app = await buildApp({ db: dbHandle, auth });
  };

  beforeEach(async () => {
    await buildWith(CREDENTIALS);
  });

  afterEach(async () => {
    await app.close();
    dbHandle.close();
  });

  for (const provider of ['google', 'github'] as const) {
    it(`sends ${provider} to its authorize endpoint`, async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/auth/sign-in/social',
        payload: { provider, callbackURL: 'http://localhost:5173/lobby' },
        headers: { 'content-type': 'application/json' },
      });

      expect(res.statusCode).toBe(200);
      const { url } = res.json<{ url: string }>();
      const authorize = new URL(url);
      expect(authorize.host).toBe(AUTHORIZE_HOST[provider]);
      expect(authorize.searchParams.get('client_id')).toBe(CREDENTIALS[provider].clientId);
      expect(authorize.searchParams.get('redirect_uri')).toBe(
        `http://localhost:3001/api/auth/callback/${provider}`,
      );
    });
  }

  it('lists the configured providers', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/providers' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ providers: ['google', 'github'] });
  });

  it('omits a provider it has no credentials for', async () => {
    await app.close();
    dbHandle.close();
    await buildWith({ github: CREDENTIALS.github });

    const res = await app.inject({ method: 'GET', url: '/auth/providers' });

    expect(res.json()).toEqual({ providers: ['github'] });
  });

  it('does not need a session to list them', async () => {
    const gated = await app.inject({ method: 'GET', url: '/rooms' });
    expect(gated.statusCode).toBe(401);

    const res = await app.inject({ method: 'GET', url: '/auth/providers' });
    expect(res.statusCode).toBe(200);
  });
});
