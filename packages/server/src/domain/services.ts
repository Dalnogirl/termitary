import type { ConnectionRegistry } from './connection-registry.js';
import type { RoomStore } from './room-store.js';

export type Services = {
  readonly rooms: RoomStore;
  readonly connections: ConnectionRegistry;
};
