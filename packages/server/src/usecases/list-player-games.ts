import type { Color } from '@termitary/engine';
import type { ArchivedGameSummaryDto, ArchivedPlayerDto } from '@termitary/protocol';
import type { ArchivedGameCursor, ArchivedGameStore } from '../domain/archived-game-store.js';
import {
  type ArchivedGameOverview,
  type ArchivedPlayer,
  archivedSeatOf,
} from '../domain/archived-game.js';

/** `next` is where the following page resumes, absent on the last page. */
export type PlayerGamesPage = {
  readonly items: readonly ArchivedGameSummaryDto[];
  readonly next?: ArchivedGameCursor;
};

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
  query: { readonly limit: number; readonly before?: ArchivedGameCursor | undefined },
  archive: ArchivedGameStore,
): Promise<PlayerGamesPage> => {
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
    ? { items, next: { finishedAt: last.finishedAt, id: last.id } }
    : { items };
};
