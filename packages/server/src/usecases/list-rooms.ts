import type { RoomSummary } from '@hive/protocol';
import type { RoomOverview, RoomStore } from '../domain/room-store.js';

// A room nobody has touched in this long is swept when the lobby is read.
// Only rooms with a free seat or a finished game qualify, so a real game in
// progress is never removed under the players.
export const ABANDONED_ROOM_TTL_MS = 24 * 60 * 60 * 1000;

const countPlayers = (room: RoomOverview): 0 | 1 | 2 => {
  const { white, black } = room.players;
  if (white !== undefined && black !== undefined) return 2;
  if (white !== undefined || black !== undefined) return 1;
  return 0;
};

export const summarize = (room: RoomOverview): RoomSummary => ({
  roomId: room.id,
  playerCount: countPlayers(room),
  status: room.status,
});

export const listRooms = async (
  rooms: RoomStore,
  now: Date = new Date(),
): Promise<readonly RoomSummary[]> => {
  // Swept here rather than on a timer: the lobby is the only place stale rooms
  // are visible, and it is read often enough to keep the table small.
  await rooms.deleteAbandonedBefore(new Date(now.getTime() - ABANDONED_ROOM_TTL_MS));
  const all = await rooms.list();
  return all.map(summarize);
};
