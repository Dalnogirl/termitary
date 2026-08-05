import type { Room } from './room.js';

// TODO(phase-8): once the DDB adapter lands, add optimistic concurrency to
// avoid last-write-wins. Likely shape: a `version` field on Room and
// `save(room, expectedVersion?)`. In-memory Phase 3 is single-writer per
// playerId so the race window isn't reachable yet.
export type RoomStore = {
  create(room: Room): Promise<void>;
  get(id: string): Promise<Room | undefined>;
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
