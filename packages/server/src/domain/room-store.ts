import type { GameState, Ruleset } from '@termitary/engine';
import type { Room, Seats } from './room.js';

// What the lobby needs. The listing queries return this rather than whole
// rooms so the lobby never deserializes a game, and one unreadable game
// cannot fail the listing for everyone.
export type RoomOverview = {
  readonly id: string;
  readonly players: Seats;
  readonly status: GameState['status'];
  readonly updatedAt: Date;
  readonly ruleset: Ruleset;
};

// TODO: `save` is last-write-wins, and the race is application-level rather
// than a storage-engine property. `makeMove` awaits `get`, validates, then
// awaits `save`; two handlers for one room can both read before either writes.
// The `rooms.version` column exists and increments, but nothing compares it.
// Closing this needs a `WHERE version = ?` predicate, an expected version on
// `save`, and conflict handling in the callers.
export type RoomStore = {
  create(room: Room): Promise<void>;
  get(id: string): Promise<Room | undefined>;
  /**
   * Insert or replace: `save` on an unknown id writes it. Both timestamps are
   * written as the room carries them, so a caller that wants `updatedAt` to
   * move calls `touch` first.
   */
  save(room: Room): Promise<void>;
  delete(id: string): Promise<void>;
  /**
   * Games in progress the player holds a seat in, most recently played first.
   * The predicate lives in the store for the same reason as
   * `deleteAbandonedBefore`: callers never scan the whole table.
   */
  listSeatedBy(playerId: string): Promise<readonly RoomOverview[]>;
  /** Games in progress with a free seat that the player is not already in. */
  listOpenExcluding(playerId: string): Promise<readonly RoomOverview[]>;
  /**
   * Finished games last written before `cutoff`, whole rather than projected:
   * the sweep archives each one before deleting it, which needs the state.
   */
  listFinishedBefore(cutoff: Date): Promise<readonly Room[]>;
  /**
   * Removes rooms last written before `cutoff` with a free seat, which nobody
   * can be waiting in. A full game in progress is never swept, however old,
   * because both players can still return to it. Finished games are left to
   * `listFinishedBefore` and `delete`, so none is dropped unarchived.
   * Returns the number of rooms removed.
   */
  deleteAbandonedBefore(cutoff: Date): Promise<number>;
};

export class RoomAlreadyExistsError extends Error {
  constructor(id: string) {
    super(`room ${id} already exists`);
    this.name = 'RoomAlreadyExistsError';
  }
}
