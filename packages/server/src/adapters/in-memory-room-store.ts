import { RoomAlreadyExistsError, type RoomOverview, type RoomStore } from '../domain/room-store.js';
import { type Room, isFull } from '../domain/room.js';

type Entry = { readonly room: Room; readonly createdAt: Date; readonly updatedAt: Date };

const overview = ({ room, updatedAt }: Entry): RoomOverview => ({
  id: room.id,
  players: room.players,
  status: room.state.status,
  updatedAt,
});

const isInProgress = ({ room }: Entry): boolean => room.state.status === 'in_progress';

const seats = ({ room }: Entry) => [room.players.white, room.players.black];

const newestFirst = (key: 'createdAt' | 'updatedAt') => (a: Entry, b: Entry) =>
  b[key].getTime() - a[key].getTime();

const isSweepable = ({ room }: Entry): boolean => room.state.status === 'finished' || !isFull(room);

export const createInMemoryRoomStore = (now: () => Date = () => new Date()): RoomStore => {
  const rooms = new Map<string, Entry>();
  return {
    create: async (room) => {
      if (rooms.has(room.id)) throw new RoomAlreadyExistsError(room.id);
      const at = now();
      rooms.set(room.id, { room, createdAt: at, updatedAt: at });
    },
    get: async (id) => rooms.get(id)?.room,
    save: async (room) => {
      rooms.set(room.id, {
        room,
        createdAt: rooms.get(room.id)?.createdAt ?? now(),
        updatedAt: now(),
      });
    },
    delete: async (id) => {
      rooms.delete(id);
    },
    listSeatedBy: async (playerId) =>
      [...rooms.values()]
        .filter((e) => isInProgress(e) && seats(e).some((s) => s?.playerId === playerId))
        .sort(newestFirst('updatedAt'))
        .map(overview),

    listOpenExcluding: async (playerId) =>
      [...rooms.values()]
        .filter(
          (e) =>
            isInProgress(e) &&
            seats(e).some((s) => s === undefined) &&
            !seats(e).some((s) => s?.playerId === playerId),
        )
        .sort(newestFirst('createdAt'))
        .map(overview),
    deleteAbandonedBefore: async (cutoff) => {
      const stale = [...rooms.entries()].filter(
        ([, entry]) => entry.updatedAt < cutoff && isSweepable(entry),
      );
      for (const [id] of stale) rooms.delete(id);
      return stale.length;
    },
  };
};
