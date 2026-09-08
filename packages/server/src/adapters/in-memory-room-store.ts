import { RoomAlreadyExistsError, type RoomOverview, type RoomStore } from '../domain/room-store.js';
import { type Room, isFull } from '../domain/room.js';

type Entry = { readonly room: Room; readonly updatedAt: Date };

const overview = ({ room }: Entry): RoomOverview => ({
  id: room.id,
  players: room.players,
  status: room.state.status,
});

const isSweepable = ({ room }: Entry): boolean => room.state.status === 'finished' || !isFull(room);

export const createInMemoryRoomStore = (now: () => Date = () => new Date()): RoomStore => {
  const rooms = new Map<string, Entry>();
  return {
    create: async (room) => {
      if (rooms.has(room.id)) throw new RoomAlreadyExistsError(room.id);
      rooms.set(room.id, { room, updatedAt: now() });
    },
    get: async (id) => rooms.get(id)?.room,
    save: async (room) => {
      rooms.set(room.id, { room, updatedAt: now() });
    },
    delete: async (id) => {
      rooms.delete(id);
    },
    list: async () => [...rooms.values()].map(overview),
    deleteAbandonedBefore: async (cutoff) => {
      const stale = [...rooms.entries()].filter(
        ([, entry]) => entry.updatedAt < cutoff && isSweepable(entry),
      );
      for (const [id] of stale) rooms.delete(id);
      return stale.length;
    },
  };
};
