import type { Identity } from '../domain/identity.js';
import type { RoomStore } from '../domain/room-store.js';
import { colorOf, isFull } from '../domain/room.js';

export type CancelRoomResult = 'cancelled' | 'not-found' | 'forbidden';

// Deleting a room is only ever cancelling one nobody joined. Once a second
// player is seated the game is real, and the way out is `resign`.
export const cancelRoom = async (
  identity: Identity,
  roomId: string,
  rooms: RoomStore,
): Promise<CancelRoomResult> => {
  const room = await rooms.get(roomId);
  if (room === undefined) return 'not-found';
  if (colorOf(room, identity.playerId) === undefined) return 'forbidden';
  if (isFull(room)) return 'forbidden';

  await rooms.delete(room.id);
  return 'cancelled';
};
