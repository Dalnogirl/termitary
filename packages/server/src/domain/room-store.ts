import type { Room } from './room.js';

// TODO: `save` is last-write-wins, and the race is application-level rather
// than a storage-engine property. `makeMove` awaits `get`, validates, then
// awaits `save`; two handlers for one room can both read before either writes.
// The `rooms.version` column exists and increments, but nothing compares it.
// Closing this needs a `WHERE version = ?` predicate, an expected version on
// `save`, and conflict handling in the callers.
export type RoomStore = {
  create(room: Room): Promise<void>;
  get(id: string): Promise<Room | undefined>;
  /** Insert or replace: `save` on an unknown id writes it. */
  save(room: Room): Promise<void>;
  delete(id: string): Promise<void>;
  list(): Promise<readonly Room[]>;
};

export class RoomAlreadyExistsError extends Error {
  constructor(id: string) {
    super(`room ${id} already exists`);
    this.name = 'RoomAlreadyExistsError';
  }
}
