import type { ArchivedGameSummaryDto, Page } from '@termitary/protocol';
import { z } from 'zod';
import type { ArchivedGameCursor, ArchivedGameStore } from '../domain/archived-game-store.js';
import { type ArchivedGameOverview, archivedSeatOf } from '../domain/archived-game.js';
import type { Identity } from '../domain/identity.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

const encodeCursor = ({ finishedAt, id }: ArchivedGameCursor): string =>
  Buffer.from(`${finishedAt.getTime()}|${id}`).toString('base64url');

const decodeCursor = (raw: string): ArchivedGameCursor | undefined => {
  const parts = Buffer.from(raw, 'base64url').toString('utf8').split('|');
  const [millis, id] = parts;
  if (parts.length !== 2 || millis === undefined || !id) return undefined;
  const finishedAt = Number(millis);
  return Number.isSafeInteger(finishedAt) ? { finishedAt: new Date(finishedAt), id } : undefined;
};

// The cursor is the one part of this the client hands back, so it is the part
// zod parses: a string that does not decode is a 400, not a 500 further down.
const CursorSchema = z.string().transform((raw, ctx) => {
  const cursor = decodeCursor(raw);
  if (cursor === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'malformed cursor' });
    return z.NEVER;
  }
  return cursor;
});

export const ArchivedGamesQuerySchema = z.object({
  before: CursorSchema.optional(),
  // Asking for more than the cap is answered with the cap rather than refused;
  // the cursor is what the caller pages with either way.
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .default(DEFAULT_LIMIT)
    .transform((n) => Math.min(n, MAX_LIMIT)),
});

export type ArchivedGamesQuery = z.infer<typeof ArchivedGamesQuerySchema>;

// The store answers with games this player holds a seat in, so a row without
// one is a store bug rather than a case to render.
export const summarizeArchived = (
  playerId: string,
  game: ArchivedGameOverview,
): ArchivedGameSummaryDto | undefined => {
  const seat = archivedSeatOf(game.players, playerId);
  if (seat === undefined) return undefined;
  return {
    gameId: game.id,
    seat,
    players: {
      white: game.players.white?.name ?? null,
      black: game.players.black?.name ?? null,
    },
    result: game.result,
    endReason: game.endReason,
    startedAt: game.startedAt.getTime(),
    finishedAt: game.finishedAt.getTime(),
    moveCount: game.moveCount,
  };
};

export const listArchivedGames = async (
  identity: Identity,
  query: ArchivedGamesQuery,
  archive: ArchivedGameStore,
): Promise<Page<ArchivedGameSummaryDto>> => {
  // One row past the page, so a full page is distinguishable from the last one
  // without a count query.
  const rows = await archive.listForPlayer(identity.playerId, {
    limit: query.limit + 1,
    ...(query.before === undefined ? {} : { before: query.before }),
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  const items = page.flatMap((game) => summarizeArchived(identity.playerId, game) ?? []);
  return rows.length > page.length && last !== undefined
    ? { items, nextCursor: encodeCursor({ finishedAt: last.finishedAt, id: last.id }) }
    : { items };
};
