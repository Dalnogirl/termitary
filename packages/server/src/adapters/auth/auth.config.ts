// CLI-only entry point for `@better-auth/cli generate`.
// Mirrors the plugin set of `createAuth` so the generated schema matches
// what the runtime adapter expects. Not imported by application code.
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP } from 'better-auth/plugins';

export const auth = betterAuth({
  // CLI only inspects the adapter's `provider` to pick its emitter — no
  // connection is attempted at schema-gen time.
  database: drizzleAdapter({} as never, { provider: 'sqlite' }),
  emailAndPassword: { enabled: false },
  plugins: [
    emailOTP({
      sendVerificationOTP: async () => {
        /* unused at schema-gen time */
      },
    }),
  ],
});
