import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import fastifyStatic from '@fastify/static';
import websocket from '@fastify/websocket';
import { IllegalRulesetError } from '@termitary/engine';
import type { AuthProvidersDto } from '@termitary/protocol';
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
  type FastifyServerOptions,
} from 'fastify';
import { type Auth, configuredSocialProviders, createAuth } from './adapters/auth/better-auth.js';
import { registerAuth } from './adapters/auth/fastify.js';
import { type DbHandle, createDb } from './adapters/db/client.js';
import { createDrizzleArchivedGameStore } from './adapters/drizzle-archived-game-store.js';
import { createDrizzleRoomStore } from './adapters/drizzle-room-store.js';
import { createDrizzleUserStore } from './adapters/drizzle-user-store.js';
import { createInMemoryConnectionRegistry } from './adapters/in-memory-connection-registry.js';
import type { Identity } from './domain/identity.js';
import type { Ports } from './domain/ports.js';
import { env } from './env.js';
import { type CancelRoomResult, cancelRoom } from './usecases/cancel-room.js';
import { CreateRoomBodySchema, coinFlip, createRoom } from './usecases/create-room.js';
import { getArchivedGame } from './usecases/get-archived-game.js';
import { getProfile } from './usecases/get-profile.js';
import { listMyRooms } from './usecases/list-my-rooms.js';
import { ArchivedGamesQuerySchema, listPlayerGames } from './usecases/list-player-games.js';
import { listRooms } from './usecases/list-rooms.js';
import { RenameProfileBodySchema, renameProfile } from './usecases/rename-profile.js';
import { type SweepPorts, sweepAbandonedRooms } from './usecases/sweep-abandoned-rooms.js';
import { handleConnection } from './ws/connection.js';
import { type IdentityExtractor, createIdentityExtractor } from './ws/identity.js';

declare module 'fastify' {
  interface FastifyRequest {
    identity: Identity | null;
  }
}

export type BuildAppOptions = {
  loggerInstance?: FastifyServerOptions['loggerInstance'];
  /** 0 disables the periodic sweep. */
  roomSweepIntervalMs?: number;
  // Test seam: callers may inject a pre-built db + auth (e.g. an in-memory
  // sqlite shared between asserts). Defaults wire from env.
  db?: DbHandle;
  auth?: Auth;
  /** Test seam: the directory the built SPA is served from, or false to serve none. */
  webDist?: string | false;
};

export const buildApp = async (options: BuildAppOptions = {}): Promise<FastifyInstance> => {
  const app = Fastify({
    ...(options.loggerInstance ? { loggerInstance: options.loggerInstance } : { logger: false }),
    // Fastify logs every request twice, as multi-line req/res dumps. The
    // onResponse hook below replaces both with one line.
    disableRequestLogging: true,
  });

  app.addHook('onResponse', logRequest);

  const dbHandle = options.db ?? createDb(env.databaseUrl);
  const rooms = createDrizzleRoomStore(dbHandle.db);
  const connections = createInMemoryConnectionRegistry();
  const archive = createDrizzleArchivedGameStore(dbHandle.db);
  const users = createDrizzleUserStore(dbHandle.db);

  // Before `createAuth`, which writes a profile through this port on sign-up.
  const auth = options.auth ?? createAuth(dbHandle.db, users, app.log);
  const extractIdentity = createIdentityExtractor(auth);
  // app.log is the Logger port's adapter: pino when index.ts injects one,
  // and Fastify's no-op logger otherwise, which is what keeps tests quiet.
  const ports: Ports = { rooms, connections, archive, users, log: app.log };

  app.decorateRequest('identity', null);

  const sweepTimer = startRoomSweep(
    app,
    ports,
    options.roomSweepIntervalMs ?? env.roomSweepIntervalMs,
  );

  app.addHook('onClose', async () => {
    if (sweepTimer !== undefined) clearInterval(sweepTimer);
    if (!options.db) dbHandle.close();
  });

  await app.register(websocket);
  await registerAuth(app, auth);

  const gate = gateIdentity(extractIdentity);

  app.get('/api/health', async () => ({ ok: true }));
  // Ungated on purpose: /signin is the one page with no session, and it is the
  // only caller. Deliberately not under /api/auth, which better-auth owns
  // wholesale.
  app.get(
    '/api/auth-providers',
    async (): Promise<AuthProvidersDto> => ({
      providers: configuredSocialProviders(auth),
    }),
  );
  app.get('/api/rooms', { preHandler: gate }, async (req) =>
    listRooms(requireIdentity(req), rooms),
  );
  app.get('/api/rooms/mine', { preHandler: gate }, async (req) =>
    listMyRooms(requireIdentity(req), rooms),
  );
  app.post('/api/rooms', { preHandler: gate }, async (req, reply) => {
    const body = CreateRoomBodySchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid-body' });
    try {
      return await createRoom(requireIdentity(req), body.data, rooms, coinFlip);
    } catch (err) {
      // A ruleset the schema accepts can still be unplayable, queenless being
      // the one that matters. The engine owns that judgement, so the route
      // waits for it rather than repeating the rule.
      if (err instanceof IllegalRulesetError) {
        return reply.code(400).send({ error: 'invalid-ruleset' });
      }
      throw err;
    }
  });
  app.delete<{ Params: { id: string } }>(
    '/api/rooms/:id',
    { preHandler: gate },
    async (req, reply) => {
      const outcome = await cancelRoom(requireIdentity(req), req.params.id, rooms);
      return reply.code(CANCEL_ROOM_STATUS[outcome]).send();
    },
  );
  app.patch('/api/profile', { preHandler: gate }, async (req, reply) => {
    const body = RenameProfileBodySchema.safeParse(req.body);
    // The zod message is the copy the form shows, so it is sent as-is rather
    // than flattened to a code the client would have to translate back.
    if (!body.success) {
      return reply.code(400).send({ error: body.error.issues[0]?.message ?? 'Invalid name.' });
    }
    const result = await renameProfile(requireIdentity(req), body.data.name, ports);
    if (result.outcome === 'gone') return reply.code(404).send({ error: 'not-found' });
    return result.profile;
  });
  app.get<{ Params: { userId: string } }>(
    '/api/users/:userId',
    { preHandler: gate },
    async (req, reply) => {
      const profile = await getProfile(req.params.userId, ports);
      if (profile === undefined) return reply.code(404).send({ error: 'not-found' });
      return profile;
    },
  );
  app.get<{ Params: { userId: string } }>(
    '/api/users/:userId/games',
    { preHandler: gate },
    async (req, reply) => {
      const query = ArchivedGamesQuerySchema.safeParse(req.query);
      if (!query.success) return reply.code(400).send({ error: 'invalid query' });
      return listPlayerGames(req.params.userId, query.data, archive);
    },
  );
  app.get<{ Params: { id: string } }>(
    '/api/archived-games/:id',
    { preHandler: gate },
    async (req, reply) => {
      const game = await getArchivedGame(requireIdentity(req), req.params.id, archive);
      if (game === undefined) return reply.code(404).send({ error: 'not-found' });
      return game;
    },
  );
  app.get('/ws', { websocket: true, preValidation: gate }, (socket, req) => {
    handleConnection({
      socket,
      req,
      identity: requireIdentity(req),
      ports,
      lifecycle: connections,
    });
  });

  const webDist = options.webDist ?? WEB_DIST;
  if (webDist !== false) await serveWebDist(app, webDist);

  return app;
};

// Resolved from this module rather than the working directory, which a process
// supervisor owns and we do not.
const WEB_DIST = fileURLToPath(new URL('../../web/dist/', import.meta.url));

// Every API route lives under /api, so one prefix is the whole exclusion and
// anything else is an SPA deep link. Without it the URL alone cannot say
// whether /archived-games/:id means the API's route or react-router's.
const isApiPath = (path: string): boolean =>
  path === '/api' || path.startsWith('/api/') || path === '/ws';

// Static had its chance already, so a path naming a file is a missing asset
// rather than a deep link. A tab left open across a redeploy asks for a chunk
// that is gone, and a page in its place is an HTML parse error where a 404
// would have said what happened.
const namesAFile = (path: string): boolean => path.slice(path.lastIndexOf('/')).includes('.');

/**
 * The built SPA, on the same origin as the API. That is what makes the session
 * cookie a same-origin cookie, and why nothing here configures CORS.
 *
 * A checkout that has never run `pnpm build` has no dist, which is the normal
 * state under `pnpm dev` and never acceptable in production.
 */
const serveWebDist = async (app: FastifyInstance, root: string): Promise<void> => {
  if (!existsSync(root)) {
    if (env.nodeEnv === 'production') {
      throw new Error(`No web bundle at ${root}. Run \`pnpm build\` before booting.`);
    }
    app.log.info({ dir: root }, 'no web bundle; serving the API alone');
    return;
  }

  await app.register(fastifyStatic, { root });
  app.setNotFoundHandler((req, reply) => {
    const path = req.url.split('?')[0] ?? '';
    // HEAD as well as GET: @fastify/static answers HEAD for a real file, and an
    // uptime check or a link preview would otherwise see deep links 404.
    const readingAPage = req.method === 'GET' || req.method === 'HEAD';
    if (!readingAPage || isApiPath(path) || namesAFile(path)) {
      return reply.code(404).send({ error: 'not-found' });
    }
    return reply.sendFile('index.html');
  });
};

// Status picks the level so pino-pretty colours the line: 2xx green, 4xx
// yellow, 5xx red. The fields repeat the message so JSON output stays queryable
// and the pretty transport ignores them.
const logRequest = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
  const status = reply.statusCode;
  const ms = Math.round(reply.elapsedTime * 10) / 10;
  const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
  req.log[level](
    { method: req.method, url: req.url, status, ms },
    `${req.method} ${req.url} ${status} ${ms}ms`,
  );
};

const CANCEL_ROOM_STATUS: Record<CancelRoomResult, number> = {
  cancelled: 204,
  'not-found': 404,
  forbidden: 403,
};

const sweepAndLog = (app: FastifyInstance, ports: SweepPorts): void => {
  void sweepAbandonedRooms(ports)
    .then((removed) => {
      if (removed > 0) app.log.info({ removed }, 'swept abandoned rooms');
    })
    .catch((err: unknown) => app.log.error({ err }, 'room sweep failed'));
};

const startRoomSweep = (
  app: FastifyInstance,
  ports: SweepPorts,
  intervalMs: number,
): NodeJS.Timeout | undefined => {
  if (intervalMs <= 0) return undefined;
  sweepAndLog(app, ports);
  // unref'd so the timer never holds the process open; onClose clears it.
  return setInterval(() => sweepAndLog(app, ports), intervalMs).unref();
};

const gateIdentity =
  (extract: IdentityExtractor) =>
  async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const identity = await extract(req);
    if (identity === null) {
      reply.code(401).send({ error: 'unauthenticated' });
      return;
    }
    req.identity = identity;
  };

// The gate hook either sets req.identity or sends 401. Reaching a handler
// without identity is a framework invariant violation, not a runtime branch.
const requireIdentity = (req: FastifyRequest): Identity => {
  if (req.identity === null) throw new Error('unreachable: gate did not set identity');
  return req.identity;
};
