import type { MyRoomSummaryDto } from '@hive/protocol';
import type { Identity } from '../domain/identity.js';
import type { RoomOverview, RoomStore } from '../domain/room-store.js';
import { seatOf } from '../domain/room.js';

// The store answers with rooms this player is seated in, so a row without a
// seat is a store bug rather than a case to render.
const summarizeMine = (playerId: string, room: RoomOverview): MyRoomSummaryDto | undefined => {
  const seat = seatOf(room.players, playerId);
  if (seat === undefined) return undefined;
  const { white, black } = room.players;
  return {
    roomId: room.id,
    seat,
    playerCount: white !== undefined && black !== undefined ? 2 : 1,
    updatedAt: room.updatedAt.getTime(),
  };
};

export const listMyRooms = async (
  identity: Identity,
  rooms: RoomStore,
): Promise<readonly MyRoomSummaryDto[]> => {
  const mine = await rooms.listSeatedBy(identity.playerId);
  return mine.flatMap((room) => summarizeMine(identity.playerId, room) ?? []);
};
