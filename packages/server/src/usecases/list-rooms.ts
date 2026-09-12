import type { RoomSummaryDto } from '@termitary/protocol';
import type { Identity } from '../domain/identity.js';
import type { RoomOverview, RoomStore } from '../domain/room-store.js';

const countPlayers = (room: RoomOverview): 0 | 1 | 2 => {
  const { white, black } = room.players;
  if (white !== undefined && black !== undefined) return 2;
  if (white !== undefined || black !== undefined) return 1;
  return 0;
};

export const summarize = (room: RoomOverview): RoomSummaryDto => ({
  roomId: room.id,
  playerCount: countPlayers(room),
  status: room.status,
});

export const listRooms = async (
  identity: Identity,
  rooms: RoomStore,
): Promise<readonly RoomSummaryDto[]> => {
  const open = await rooms.listOpenExcluding(identity.playerId);
  return open.map(summarize);
};
