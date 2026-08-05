import type { RoomSummary } from '@hive/protocol';
import type { RoomStore } from '../domain/room-store.js';
import type { Room } from '../domain/room.js';

const countPlayers = (room: Room): 0 | 1 | 2 => {
  const [w, b] = room.players;
  if (w !== undefined && b !== undefined) return 2;
  if (w !== undefined || b !== undefined) return 1;
  return 0;
};

export const summarize = (room: Room): RoomSummary => ({
  roomId: room.id,
  playerCount: countPlayers(room),
  status: room.state.status,
});

export const listRooms = async (rooms: RoomStore): Promise<readonly RoomSummary[]> => {
  const all = await rooms.list();
  return all.map(summarize);
};
