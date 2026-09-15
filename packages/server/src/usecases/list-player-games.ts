import type { Color } from '@termitary/engine';
import type { ArchivedGameSummaryDto, ArchivedPlayerDto, Page } from '@termitary/protocol';
import { z } from 'zod';
import type { ArchivedGameStore } from '../domain/archived-game-store.js';
import {
  type ArchivedGameOverview,
  type ArchivedPlayer,
  archivedSeatOf,
} from '../domain/archived-game.js';
import { decodeCursor, encodeCursor } from '../http/keyset-cursor.js';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// The cursor is the one part of this the client hands back, so it is the part
// zod parses: a string that does not decode is a 400, not a 500 further down.
const CursorSchema = z.string().transform((raw, ctx) => {
  const cursor = decodeCursor(raw);
  if (cursor === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'malformed cursor' });
    return z.NEVER;
  }
  return { finishedAt: cursor.at, id: cursor.id };
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

const seatPlayer = (player: ArchivedPlayer | undefined): ArchivedPlayerDto => ({
  userId: player?.playerId ?? null,
  name: player?.name ?? null,
});

export const summarizeArchived = (
  seat: Color,
  game: ArchivedGameOverview,
): ArchivedGameSummaryDto => ({
  gameId: game.id,
  seat,
  players: {
    white: seatPlayer(game.players.white),
    black: seatPlayer(game.players.black),
  },
  result: game.result,
  endReason: game.endReason,
  startedAt: game.startedAt.getTime(),
  finishedAt: game.finishedAt.getTime(),
  moveCount: game.moveCount,
});

// The store answers with games this player holds a seat in, so a row without
// one is a store bug rather than a case to render.
const summarizeFor = (
  playerId: string,
  game: ArchivedGameOverview,
): ArchivedGameSummaryDto | undefined => {
  const seat = archivedSeatOf(game.players, playerId);
  return seat === undefined ? undefined : summarizeArchived(seat, game);
};

export const listPlayerGames = async (
  playerId: string,
  query: ArchivedGamesQuery,
  archive: ArchivedGameStore,
): Promise<Page<ArchivedGameSummaryDto>> => {
  // One row past the page, so a full page is distinguishable from the last one
  // without a count query.
  const rows = await archive.listForPlayer(playerId, {
    limit: query.limit + 1,
    ...(query.before === undefined ? {} : { before: query.before }),
  });
  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  const items = page.flatMap((game) => summarizeFor(playerId, game) ?? []);
  return rows.length > page.length && last !== undefined
    ? { items, nextCursor: encodeCursor({ at: last.finishedAt, id: last.id }) }
    : { items };
};
