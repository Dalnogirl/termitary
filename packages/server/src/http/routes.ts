import {
  type ArchivedGameSummaryDto,
  type AuthProvidersDto,
  type Page,
  PostSeekRequestSchema,
  type PostSeekResponseDto,
  UpdateProfileRequestSchema,
} from '@termitary/protocol';
import type { FastifyInstance } from 'fastify';
import { type Auth, configuredSocialProviders } from '../adapters/auth/better-auth.js';
import type { Ports } from '../domain/ports.js';
import { type CancelSeekResult, cancelSeek } from '../usecases/cancel-seek.js';
import { getArchivedGame } from '../usecases/get-archived-game.js';
import { getProfile } from '../usecases/get-profile.js';
import { listMyRooms } from '../usecases/list-my-rooms.js';
import { type PlayerGamesPage, listPlayerGames } from '../usecases/list-player-games.js';
import { listSeeks, toSeekDto } from '../usecases/list-seeks.js';
import { postSeek } from '../usecases/post-seek.js';
import { renameProfile } from '../usecases/rename-profile.js';
import { ArchivedGamesQuerySchema } from './archived-games-query.js';
import { type Gate, requireIdentity } from './gate.js';
import { encodeCursor } from './keyset-cursor.js';

const CANCEL_SEEK_STATUS: Record<CancelSeekResult, number> = {
  cancelled: 204,
  'not-found': 404,
  forbidden: 403,
};

// Every refusal here is a race the caller lost or a limit they hit, not a
// malformed request, so they share 409 and differ by code.
const POST_SEEK_ERROR = {
  gone: 'seek-gone',
  incompatible: 'seek-incompatible',
  'own-seek': 'seek-own',
} as const;

const toPageDto = ({ items, next }: PlayerGamesPage): Page<ArchivedGameSummaryDto> =>
  next === undefined
    ? { items }
    : { items, nextCursor: encodeCursor({ at: next.finishedAt, id: next.id }) };

export const registerRoutes = (
  app: FastifyInstance,
  { ports, auth, gate }: { ports: Ports; auth: Auth; gate: Gate },
): void => {
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
  app.get('/api/rooms/mine', { preHandler: gate }, async (req) =>
    listMyRooms(requireIdentity(req), ports.rooms),
  );
  app.get('/api/seeks', { preHandler: gate }, async (req) =>
    listSeeks(requireIdentity(req), ports.seeks),
  );
  app.post('/api/seeks', { preHandler: gate }, async (req, reply) => {
    // Every field is optional, so `{}` is the default seek and the Play
    // button's whole payload. A body is still required: Fastify refuses an
    // empty one before any handler runs, so a route that claimed to treat it
    // as a default would never see it.
    const body = PostSeekRequestSchema.safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: 'invalid-body' });

    const result = await postSeek(requireIdentity(req), body.data, ports);
    switch (result.outcome) {
      case 'paired':
        return { outcome: 'paired', roomId: result.roomId } satisfies PostSeekResponseDto;
      case 'waiting':
        return { outcome: 'waiting', seek: toSeekDto(result.seek) } satisfies PostSeekResponseDto;
      default:
        return reply.code(409).send({ error: POST_SEEK_ERROR[result.outcome] });
    }
  });
  app.delete<{ Params: { id: string } }>(
    '/api/seeks/:id',
    { preHandler: gate },
    async (req, reply) => {
      const outcome = await cancelSeek(requireIdentity(req), req.params.id, ports.seeks);
      return reply.code(CANCEL_SEEK_STATUS[outcome]).send();
    },
  );
  app.patch('/api/profile', { preHandler: gate }, async (req, reply) => {
    const body = UpdateProfileRequestSchema.safeParse(req.body);
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
      return toPageDto(await listPlayerGames(req.params.userId, query.data, ports.archive));
    },
  );
  app.get<{ Params: { id: string } }>(
    '/api/archived-games/:id',
    { preHandler: gate },
    async (req, reply) => {
      const game = await getArchivedGame(requireIdentity(req), req.params.id, ports.archive);
      if (game === undefined) return reply.code(404).send({ error: 'not-found' });
      return game;
    },
  );
};
