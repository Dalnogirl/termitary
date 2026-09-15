import type { ArchivedGame, ArchivedGameOverview } from './archived-game.js';
import type { PlayerGameOutcome } from './player-record.js';

/** The last row of a page. Paging resumes strictly after it. */
export type ArchivedGameCursor = {
  readonly finishedAt: Date;
  readonly id: string;
};

export type ArchivedGamePageQuery = {
  readonly limit: number;
  readonly before?: ArchivedGameCursor;
};

export type ArchivedGameStore = {
  /**
   * Writes a finished game, keyed by its room id. Recording the same game
   * twice is a no-op: the live path and the sweep backstop both write, and
   * the row is immutable once it exists.
   */
  record(game: ArchivedGame): Promise<void>;
  /**
   * A player's finished games, most recently finished first. Keyset paging,
   * not offset: a game finishing mid-page would shift every later offset, and
   * the id breaks the tie between two games that finished in the same
   * millisecond.
   */
  listForPlayer(
    playerId: string,
    page: ArchivedGamePageQuery,
  ): Promise<readonly ArchivedGameOverview[]>;
  /**
   * Every finished game the player sat in, as the few columns a record counts.
   * Unpaged and unordered on purpose: a record is over all of them.
   */
  outcomesForPlayer(playerId: string): Promise<readonly PlayerGameOutcome[]>;
  get(id: string): Promise<ArchivedGame | undefined>;
};
