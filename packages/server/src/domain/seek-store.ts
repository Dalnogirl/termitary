import type { Seek } from './seek.js';

export type SeekStore = {
  create(seek: Seek): Promise<void>;
  /** Undefined for a seek nothing wrote, and for one nothing can read back. */
  get(id: string): Promise<Seek | undefined>;
  /**
   * Unexpired pool seeks the player did not post, oldest first. The whole row,
   * because the caller matches on `preference`: the predicate is a free
   * function in `protocol`, so no store repeats it in SQL.
   */
  listPool(excluding: string, now: Date): Promise<readonly Seek[]>;
  /** The player's own unexpired seek. A player holds at most one. */
  getFor(playerId: string, now: Date): Promise<Seek | undefined>;
  /**
   * Removes the player's seek whatever state it is in, expired or unreadable
   * included. Posting replaces rather than refuses, so this runs before every
   * create, and a row `getFor` will not return still holds the unique index.
   */
  deleteFor(playerId: string): Promise<void>;
  /**
   * Deletes the seek and returns it, or returns undefined when someone else
   * got there first. This is the whole concurrency story: two players racing
   * one seek produce one game and one loser, so a caller that reads and then
   * deletes would hand out the same seek twice.
   */
  claim(id: string): Promise<Seek | undefined>;
  /** Returns the number of seeks removed. */
  deleteExpiredBefore(now: Date): Promise<number>;
};

/** The unique index on the seeker, which is what holds one seek per player. */
export class SeekerAlreadySeekingError extends Error {
  constructor(playerId: string) {
    super(`player ${playerId} already has a seek`);
    this.name = 'SeekerAlreadySeekingError';
  }
}

export class SeekAlreadyExistsError extends Error {
  constructor(id: string) {
    super(`seek ${id} already exists`);
    this.name = 'SeekAlreadyExistsError';
  }
}
