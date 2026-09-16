import { randomUUID } from 'node:crypto';
import { BASE_RULESET, type Color } from '@termitary/engine';
import {
  type CreateRoomResponseDto,
  SeatChoiceSchema,
  WireRulesetSchema,
  fromWireRuleset,
} from '@termitary/protocol';
import { z } from 'zod';
import type { Identity } from '../domain/identity.js';
import type { RoomStore } from '../domain/room-store.js';
import { createRoom as buildRoom } from '../domain/room.js';

export const CreateRoomBodySchema = z.object({
  seat: SeatChoiceSchema,
  // Absent is base, matching the wire's own reading of a missing ruleset. The
  // schema settles piece types and counts; `createGame` settles legality and
  // the route turns its refusal into a 400.
  ruleset: WireRulesetSchema.optional(),
});
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
  const ruleset = body.ruleset === undefined ? BASE_RULESET : fromWireRuleset(body.ruleset);
  const room = buildRoom(randomUUID(), identity, seat, new Date(), ruleset);
  await roomStore.create(room);
  return { roomId: room.id };
};
