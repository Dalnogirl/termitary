import type { AuthProviderId } from '@termitary/protocol';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';
import type { Logger } from '../../domain/logger.js';
import type { UserStore } from '../../domain/user-store.js';
import { type SocialProviders, env } from '../../env.js';
import * as authSchema from '../db/auth-schema.js';
import type { Db } from '../db/client.js';

export type Auth = ReturnType<typeof createAuth>;

export type SendOtp = (args: {
  email: string;
  otp: string;
  type: 'sign-in' | 'email-verification' | 'forget-password' | 'change-email';
}) => Promise<void>;

// Phase 4 dev: print OTPs. Phase 7 swaps in real SMTP/SES.
const printOtp =
  (log: Logger): SendOtp =>
  async ({ email, otp, type }) => {
    log.info({ email, type }, `OTP ${otp}`);
  };

export const createAuth = (
  db: Db,
  users: UserStore,
  log: Logger,
  opts: { sendOtp?: SendOtp; socialProviders?: SocialProviders } = {},
) =>
  betterAuth({
    database: drizzleAdapter(db, { provider: 'sqlite', schema: authSchema }),
    secret: env.authSecret,
    baseURL: env.authBaseUrl,
    trustedOrigins: [...env.trustedOrigins],
    emailAndPassword: { enabled: false },
    // The display name is ours, not better-auth's: whatever it writes to
    // `user.name` we never read.
    //
    // On session create, not user create. better-auth commits the `user` row
    // before running the hook, so a hook that throws leaves the account behind
    // and `user.create` never fires again for it. Every sign-in opens a
    // session, so this insert retries where a create hook could not.
    //
    // Swallowed on purpose: the session row is already committed when this
    // runs, so a throw would 500 a sign-in that otherwise worked and leave a
    // session no client ever receives a cookie for. A missing profile is what
    // the next sign-in repairs.
    databaseHooks: {
      session: {
        create: {
          after: async (session) => {
            try {
              await users.ensure(session.userId, new Date());
            } catch (err) {
              log.error({ userId: session.userId, err }, 'profile write failed');
            }
          },
        },
      },
    },
    // Callbacks land at `${baseURL}/api/auth/callback/<provider>`, which is
    // what the two OAuth consoles have to be registered with.
    socialProviders: opts.socialProviders ?? env.socialProviders,
    plugins: [emailOTP({ sendVerificationOTP: opts.sendOtp ?? printOtp(log) })],
  });

// Asks the instance rather than `env` so an injected test auth answers for
// itself, and so nothing outside this directory has to read better-auth's
// option shape.
export const configuredSocialProviders = (auth: Auth): readonly AuthProviderId[] =>
  Object.keys(auth.options.socialProviders ?? {}) as AuthProviderId[];
