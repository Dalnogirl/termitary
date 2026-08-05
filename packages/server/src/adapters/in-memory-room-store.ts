import { RoomAlreadyExistsError, type RoomStore } from '../domain/room-store.js';
import type { Room } from '../domain/room.js';

export const createInMemoryRoomStore = (): RoomStore => {
  const rooms = new Map<string, Room>();
  return {
    create: async (room) => {
      if (rooms.has(room.id)) throw new RoomAlreadyExistsError(room.id);
      rooms.set(room.id, room);
    },
    get: async (id) => rooms.get(id),
    save: async (room) => {
      rooms.set(room.id, room);
    },
    delete: async (id) => {
      rooms.delete(id);
    },
    list: async () => [...rooms.values()],
  };
};
