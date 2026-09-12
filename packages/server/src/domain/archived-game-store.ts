import type { ArchivedGame, ArchivedGameOverview } from './archived-game.js';

export type ArchivedGameStore = {
  /**
   * Writes a finished game, keyed by its room id. Recording the same game
   * twice is a no-op: the live path and the sweep backstop both write, and
   * the row is immutable once it exists.
   */
  record(game: ArchivedGame): Promise<void>;
  /** A player's finished games, most recently finished first. */
  listForPlayer(playerId: string): Promise<readonly ArchivedGameOverview[]>;
  get(id: string): Promise<ArchivedGame | undefined>;
};
