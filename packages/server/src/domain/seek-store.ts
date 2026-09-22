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
  /** The player's own unexpired seeks, newest first. Private ones included. */
  listFor(playerId: string, now: Date): Promise<readonly Seek[]>;
  /** Counts exactly what `listFor` returns, so the cap only charges for seeks the player can see. */
  countFor(playerId: string, now: Date): Promise<number>;
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

export class SeekAlreadyExistsError extends Error {
  constructor(id: string) {
    super(`seek ${id} already exists`);
    this.name = 'SeekAlreadyExistsError';
  }
}
