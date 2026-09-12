import { WireGameStateSchema, fromWire, toWire } from '@termitary/protocol';
import { desc, eq, or } from 'drizzle-orm';
import type { ArchivedGameStore } from '../domain/archived-game-store.js';
import type {
  ArchivedGame,
  ArchivedGameOverview,
  ArchivedPlayer,
} from '../domain/archived-game.js';
import type { Db } from './db/client.js';
import { type ArchivedGameRow, CURRENT_ARCHIVE_STATE_VERSION, archivedGames } from './db/schema.js';

// A seat survives its account: the FK goes null on deletion, the snapshotted
// name stays. Only a game archived with the seat already empty has neither.
const seat = (userId: string | null, name: string | null): ArchivedPlayer | undefined =>
  userId === null && name === null
    ? undefined
    : { playerId: userId ?? undefined, name: name ?? undefined };

const overviewColumns = {
  id: archivedGames.id,
  whiteUserId: archivedGames.whiteUserId,
  blackUserId: archivedGames.blackUserId,
  whiteName: archivedGames.whiteName,
  blackName: archivedGames.blackName,
  result: archivedGames.result,
  endReason: archivedGames.endReason,
  moveCount: archivedGames.moveCount,
  startedAt: archivedGames.startedAt,
  finishedAt: archivedGames.finishedAt,
};

type OverviewRow = Omit<ArchivedGameRow, 'state' | 'stateVersion'>;

const toOverview = (row: OverviewRow): ArchivedGameOverview => ({
  id: row.id,
  players: {
    white: seat(row.whiteUserId, row.whiteName),
    black: seat(row.blackUserId, row.blackName),
  },
  result: row.result,
  endReason: row.endReason,
  startedAt: row.startedAt,
  finishedAt: row.finishedAt,
  moveCount: row.moveCount,
});

const toGame = (row: ArchivedGameRow): ArchivedGame => {
  const state = fromWire(WireGameStateSchema.parse(row.state));
  if (state.status !== 'finished') {
    throw new Error(`archived game ${row.id} is not a finished game`);
  }
  return { ...toOverview(row), state };
};

export const createDrizzleArchivedGameStore = (db: Db): ArchivedGameStore => ({
  // Written twice whenever the sweep backstops a game the live path already
  // archived, so the second write has to be a no-op rather than a rewrite.
  record: async (game) => {
    db.insert(archivedGames)
      .values({
        id: game.id,
        whiteUserId: game.players.white?.playerId ?? null,
        blackUserId: game.players.black?.playerId ?? null,
        whiteName: game.players.white?.name ?? null,
        blackName: game.players.black?.name ?? null,
        result: game.result,
        endReason: game.endReason,
        state: toWire(game.state),
        stateVersion: CURRENT_ARCHIVE_STATE_VERSION,
        moveCount: game.moveCount,
        startedAt: game.startedAt,
        finishedAt: game.finishedAt,
      })
      .onConflictDoNothing({ target: archivedGames.id })
      .run();
  },

  listForPlayer: async (playerId): Promise<readonly ArchivedGameOverview[]> =>
    db
      .select(overviewColumns)
      .from(archivedGames)
      .where(or(eq(archivedGames.whiteUserId, playerId), eq(archivedGames.blackUserId, playerId)))
      .orderBy(desc(archivedGames.finishedAt))
      .all()
      .map(toOverview),

  get: async (id) => {
    const row = db.select().from(archivedGames).where(eq(archivedGames.id, id)).get();
    return row === undefined ? undefined : toGame(row);
  },
});
