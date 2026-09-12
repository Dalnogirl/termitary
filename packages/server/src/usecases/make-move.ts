import { IllegalMoveError, applyMove } from '@termitary/engine';
import type { ClientMakeMove } from '@termitary/protocol';
import { fromWireMove, toWire } from '@termitary/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { type Room, colorOf } from '../domain/room.js';
import { sendError } from './send-error.js';

export const makeMove = async (
  identity: Identity,
  msg: ClientMakeMove,
  { rooms, connections }: Ports,
): Promise<void> => {
  const room = await rooms.get(msg.roomId);
  if (room === undefined) {
    await sendError(connections, identity, 'room not found', 'makeMove');
    return;
  }
  const color = colorOf(room, identity.playerId);
  if (color === undefined) {
    await sendError(connections, identity, 'not in room', 'makeMove');
    return;
  }
  if (room.state.status === 'finished') {
    await sendError(connections, identity, 'game already finished', 'makeMove');
    return;
  }
  if (room.state.currentPlayer !== color) {
    await sendError(connections, identity, 'not your turn', 'makeMove');
    return;
  }

  let updated: Room;
  try {
    updated = { ...room, state: applyMove(room.state, fromWireMove(msg.move)) };
  } catch (err) {
    const message = err instanceof IllegalMoveError ? err.message : 'illegal move';
    await sendError(connections, identity, message, 'makeMove');
    return;
  }

  await rooms.save(updated);
  await connections.broadcast(updated.id, {
    type: 'stateUpdated',
    roomId: updated.id,
    state: toWire(updated.state),
  });
};
