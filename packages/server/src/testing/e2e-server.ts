import { createAuth } from '../adapters/auth/better-auth.js';
import { createDb } from '../adapters/db/client.js';
import { createDrizzleUserStore } from '../adapters/drizzle-user-store.js';
import { log } from '../adapters/logger.js';
import { buildApp } from '../app.js';
import { env } from '../env.js';

/**
 * The real server, listening, over a database that dies with the process.
 * Everything here is what `pnpm dev` runs except the OTP sink: a browser has no
 * way to read a code the console printed, and scraping the log for a six digit
 * number rots the first time the line changes.
 *
 * `env` still decides the port, the bind host and the origins, so a spec that
 * wants a broken CORS configuration boots this with a different `WEB_ORIGIN`.
 */
const otps = new Map<string, string>();

const db = createDb(':memory:');
const auth = createAuth(db.db, createDrizzleUserStore(db.db), log, {
  sendOtp: async ({ email, otp }) => {
    otps.set(email, otp);
  },
});
// The same request log `pnpm dev` prints, because a browser spec that fails on
// CI leaves nothing else to read.
const app = await buildApp({ db, auth, roomSweepIntervalMs: 0, loggerInstance: log });

// Registered here and nowhere else, so no deployment can serve it.
app.get<{ Querystring: { email?: string } }>('/e2e/otp', async (req, reply) => {
  const email = req.query.email ?? '';
  const otp = otps.get(email);
  if (otp === undefined) return reply.code(404).send({ error: 'no-otp' });
  // Read once: a second sign-in for the same address would otherwise be handed
  // the previous code the instant it asked, before the new one had arrived.
  otps.delete(email);
  return { otp };
});

await app.listen({ port: env.port, host: env.host });
