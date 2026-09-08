import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { env } from '../../env.js';
import * as schema from '../db/schema.js';

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

export const createAuth = (
  db: BetterSQLite3Database<typeof schema>,
  opts: { sendOtp?: SendOtp } = {},
) =>
  betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', schema }),
    secret: env.authSecret,
    baseURL: env.authBaseUrl,
    // The web client is a separate origin from the API in dev, so its Origin
    // header matches neither baseURL nor the request host; better-auth rejects
    // the sign-in POST outright without this.
    trustedOrigins: [env.webOrigin],
    emailAndPassword: { enabled: false },
    plugins: [emailOTP({ sendVerificationOTP: opts.sendOtp ?? defaultSendOtp })],
  });
