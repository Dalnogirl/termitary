import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import type { UserStore } from '../../domain/user-store.js';
import { env } from '../../env.js';
import * as authSchema from '../db/auth-schema.js';
import type { Db } from '../db/client.js';

export type Auth = ReturnType<typeof createAuth>;

export type SendOtp = (args: {
  email: string;
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';
}) => Promise<void>;

const defaultSendOtp: SendOtp = async ({ email, otp, type }) => {
  // Phase 4 dev: print OTPs. Phase 7 swaps in real SMTP/SES.
  console.log(`[auth] OTP for ${email} (${type}): ${otp}`);
};

export const createAuth = (db: Db, users: UserStore, opts: { sendOtp?: SendOtp } = {}) =>
  betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
    secret: env.authSecret,
    baseURL: env.authBaseUrl,
    // The web client is a separate origin from the API in dev, so its Origin
    // header matches neither baseURL nor the request host; better-auth rejects
    // the sign-in POST outright without this.
    trustedOrigins: [env.webOrigin],
    emailAndPassword: { enabled: false },
    // The display name is ours, not better-auth's: it writes `user.name` as
    // `''` and we never read it.
    //
    // On session create, not user create. better-auth commits the `user` row
    // before running the hook, so a hook that throws leaves the account behind
    // and `user.create` never fires again for it. Every sign-in opens a
    // session, so this insert retries where a create hook could not.
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            await users.ensure(session.userId, new Date());
          },
        },
      },
    },
    plugins: [emailOTP({ sendVerificationOTP: opts.sendOtp ?? defaultSendOtp })],
  });
