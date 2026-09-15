// S-4.1 smoke: signup → OTP → session via the mounted /api/auth/* routes.
//
// Manual curl recipe (matches the Phase-4 plan wording):
//   pnpm --filter @termitary/server dev
//   curl -X POST http://127.0.0.1:3001/api/auth/email-otp/send-verification-otp \
//     -H 'content-type: application/json' \
//     -d '{"email":"alice@test.dev","type":"sign-in"}'
//   # server console prints: [auth] OTP for alice@test.dev (sign-in): 123456
//   curl -X POST http://127.0.0.1:3001/api/auth/sign-in/email-otp \
//     -H 'content-type: application/json' \
//     -c cookies.txt \
//     -d '{"email":"alice@test.dev","otp":"123456"}'
//   # 200 + Set-Cookie: better-auth.session_token=...
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../../app.js';
import type { UserStore } from '../../domain/user-store.js';
import { silentLog } from '../../testing/stores.js';
import { user } from '../db/auth-schema.js';
import { type DbHandle, createDb } from '../db/client.js';
import { profiles } from '../db/schema.js';
import { createDrizzleUserStore } from '../drizzle-user-store.js';
import { createAuth } from './better-auth.js';

describe('better-auth email OTP', () => {
  let app: FastifyInstance;
  let dbHandle: DbHandle;
  let otps: Array<{ email: string; otp: string }>;
  // Flipped by the retry test to fail the profile write on the first sign-in.
  let profileWriteFails = false;

  beforeEach(async () => {
    otps = [];
    profileWriteFails = false;
    dbHandle = createDb(':memory:');
    const real = createDrizzleUserStore(dbHandle.db);
    const users: UserStore = {
      ...real,
      ensure: async (userId, now) => {
        if (profileWriteFails) throw new Error('profile write is down');
        return real.ensure(userId, now);
      },
    };
    const auth = createAuth(dbHandle.db, users, silentLog, {
      sendOtp: async ({ email, otp }) => {
        otps.push({ email, otp });
      },
    });
    app = await buildApp({ db: dbHandle, auth });
  });

  afterEach(async () => {
    await app.close();
    dbHandle.close();
  });

  const signIn = async (email: string): Promise<void> => {
    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/send-verification-otp',
      payload: { email, type: 'sign-in' },
      headers: { 'content-type': 'application/json' },
    });
    expect(sendRes.statusCode).toBe(200);
    const otp = otps.at(-1)?.otp;
    const signInRes = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email-otp',
      payload: { email, otp },
      headers: { 'content-type': 'application/json' },
    });
    expect(signInRes.statusCode).toBe(200);
  };

  it('signs a user in via OTP and returns a session cookie', async () => {
    const email = 'alice@test.dev';

    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/send-verification-otp',
      payload: { email, type: 'sign-in' },
      headers: { 'content-type': 'application/json' },
    });
    expect(sendRes.statusCode).toBe(200);

    const otp = otps.find((o) => o.email === email)?.otp;
    expect(otp).toMatch(/^\d{6}$/);

    const signInRes = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email-otp',
      payload: { email, otp },
      headers: { 'content-type': 'application/json' },
    });
    expect(signInRes.statusCode).toBe(200);

    const setCookie = signInRes.headers['set-cookie'];
    const cookieStr = Array.isArray(setCookie) ? setCookie.join(';') : (setCookie ?? '');
    expect(cookieStr).toMatch(/better-auth\.session_token=/);
  });

  it('gives a new account a generated profile name', async () => {
    await signIn('alice@test.dev');

    const rows = dbHandle.db.select().from(profiles).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toMatch(/^[a-z]+-[a-z]+$/);
  });

  it('does not write a second profile on a later sign-in', async () => {
    await signIn('alice@test.dev');
    const first = dbHandle.db.select().from(profiles).all();
    await signIn('alice@test.dev');

    expect(dbHandle.db.select().from(profiles).all()).toEqual(first);
  });

  it('signs in even when the profile write fails, and repairs on the next one', async () => {
    const email = 'alice@test.dev';
    profileWriteFails = true;
    await signIn(email);
    // The account is committed either way, so nothing would re-run a
    // `user.create` hook. This is the hole a create hook alone cannot repair.
    expect(dbHandle.db.select().from(user).all()).toHaveLength(1);
    expect(dbHandle.db.select().from(profiles).all()).toHaveLength(0);

    profileWriteFails = false;
    await signIn(email);

    const rows = dbHandle.db.select().from(profiles).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.name).toMatch(/^[a-z]+-[a-z]+$/);
  });
});
