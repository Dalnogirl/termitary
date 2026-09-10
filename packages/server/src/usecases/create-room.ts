import { randomUUID } from 'node:crypto';
import type { CreateRoomResponseDto } from '@hive/protocol';
import type { Identity } from '../domain/identity.js';
import type { RoomStore } from '../domain/room-store.js';
import { createRoom as buildRoom } from '../domain/room.js';

// REST-side counterpart of the WS `createGame` use case: seats the creator in
// a fresh room and returns the id. No connection-registry interaction here —
// the creator's WS arrives later (via PlayPage) and joinGame's re-attach
// branch handles the binding.
export const createRoom = async (
  identity: Identity,
  rooms: RoomStore,
): Promise<CreateRoomResponseDto> => {
  const room = buildRoom(randomUUID(), identity);
  await rooms.create(room);
  return { roomId: room.id };
};
