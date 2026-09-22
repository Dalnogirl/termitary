import type { ArchivedGameStore } from './archived-game-store.js';
import type { ConnectionRegistry } from './connection-registry.js';
import type { Logger } from './logger.js';
import type { RoomStore } from './room-store.js';
import type { SeekStore } from './seek-store.js';
import type { UserStore } from './user-store.js';

export type Ports = {
  readonly rooms: RoomStore;
  readonly seeks: SeekStore;
  readonly connections: ConnectionRegistry;
  readonly archive: ArchivedGameStore;
  readonly users: UserStore;
  readonly log: Logger;
};
