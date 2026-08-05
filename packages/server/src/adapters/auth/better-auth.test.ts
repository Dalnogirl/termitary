// S-4.1 smoke: signup → OTP → session via the mounted /api/auth/* routes.
//
// Manual curl recipe (matches the Phase-4 plan wording):
//   pnpm --filter @hive/server dev
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
import { type DbHandle, createDb } from '../db/client.js';
import { createAuth } from './better-auth.js';

describe('better-auth email OTP', () => {
  let app: FastifyInstance;
  let dbHandle: DbHandle;
  let otps: Array<{ email: string; otp: string }>;

  beforeEach(async () => {
    otps = [];
    dbHandle = createDb(':memory:');
    const auth = createAuth(dbHandle.db, {
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
});
