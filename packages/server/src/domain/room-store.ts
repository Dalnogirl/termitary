import type { Room } from './room.js';

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
