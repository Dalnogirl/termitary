import { randomUUID } from 'node:crypto';
import type { Color } from '@termitary/engine';
import { type CreateRoomResponseDto, SeatChoiceSchema } from '@termitary/protocol';
import { z } from 'zod';
import type { Identity } from '../domain/identity.js';
import type { RoomStore } from '../domain/room-store.js';
import { createRoom as buildRoom } from '../domain/room.js';

export const CreateRoomBodySchema = z.object({ seat: SeatChoiceSchema });
export type CreateRoomBody = z.infer<typeof CreateRoomBodySchema>;

/** Picks the seat for `random`. An argument so tests can fix the flip. */
export type SeatPicker = () => Color;

export const coinFlip: SeatPicker = () => (Math.random() < 0.5 ? 'white' : 'black');

// REST-side counterpart of the WS `createGame` use case: seats the creator in
// a fresh room and returns the id. No connection-registry interaction here —
// the creator's WS arrives later (via PlayPage) and joinGame's re-attach
// branch handles the binding.
export const createRoom = async (
  identity: Identity,
  body: CreateRoomBody,
  roomStore: RoomStore,
  pickSeat: SeatPicker,
): Promise<CreateRoomResponseDto> => {
  const seat = body.seat === 'random' ? pickSeat() : body.seat;
  const room = buildRoom(randomUUID(), identity, seat, new Date());
  await roomStore.create(room);
  return { roomId: room.id };
};
