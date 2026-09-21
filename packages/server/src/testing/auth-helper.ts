import type { FastifyInstance } from 'fastify';
import { createAuth } from '../adapters/auth/better-auth.js';
import { type DbHandle, createDb } from '../adapters/db/client.js';
import { createDrizzleUserStore } from '../adapters/drizzle-user-store.js';
import { buildApp } from '../app.js';
import { silentLog } from './stores.js';

export type SignInResult = {
  readonly userId: string;
  readonly cookie: string;
};

export type TestApp = {
  readonly app: FastifyInstance;
  readonly db: DbHandle;
  signIn(email: string): Promise<SignInResult>;
};

// Reusable test bootstrap matching the S-4.1 smoke pattern:
// in-memory sqlite + capture-array OTP sender + buildApp({ db, auth }).
// Builds an unlistened app — test files own listen/close.
// Pass `existing` to reopen a database a previous app wrote; the caller owns
// closing it, since buildApp only closes a handle it created itself.
export const createTestApp = async (existing?: DbHandle): Promise<TestApp> => {
  const otps: Array<{ email: string; otp: string }> = [];
  const db = existing ?? createDb(':memory:');
  const auth = createAuth(db.db, createDrizzleUserStore(db.db), silentLog, {
    sendOtp: async ({ email, otp }) => {
      otps.push({ email, otp });
    },
  });
  // No bundle, so a test reads the same whether or not the checkout has been
  // built. The routes that serve one have their own tests.
  const app = await buildApp({ db, auth, webDist: false });

  const signIn = async (email: string): Promise<SignInResult> => {
    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/auth/email-otp/send-verification-otp',
      payload: { email, type: 'sign-in' },
      headers: { 'content-type': 'application/json' },
    });
    if (sendRes.statusCode !== 200) {
      throw new Error(`send-verification-otp failed: ${sendRes.statusCode} ${sendRes.body}`);
    }
    const otp = otps.findLast((o) => o.email === email)?.otp;
    if (!otp) throw new Error(`no OTP captured for ${email}`);

    const signInRes = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email-otp',
      payload: { email, otp },
      headers: { 'content-type': 'application/json' },
    });
    if (signInRes.statusCode !== 200) {
      throw new Error(`sign-in/email-otp failed: ${signInRes.statusCode} ${signInRes.body}`);
    }
    const setCookie = signInRes.headers['set-cookie'];
    const cookieList = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : [];
    const cookie = cookieList.map((c) => c.split(';')[0]).join('; ');
    if (!cookie.includes('better-auth.session_token=')) {
      throw new Error(`no session cookie in response: ${JSON.stringify(cookieList)}`);
    }
    const body = signInRes.json() as { user?: { id?: string } };
    const userId = body.user?.id;
    if (!userId) throw new Error(`no userId in sign-in response: ${signInRes.body}`);

    return { userId, cookie };
  };

  return { app, db, signIn };
};
