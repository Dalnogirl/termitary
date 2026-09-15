import { resign as resignGame } from '@termitary/engine';
import type { ClientResign } from '@termitary/protocol';
import { toWire } from '@termitary/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { colorOf, isFull, touch } from '../domain/room.js';
import { archiveFinished } from './archive-finished.js';
import { sendError } from './send-error.js';

// Both players stay bound to the room: the finished game is the point, and
// either of them can sit on it until the sweep takes the room.
export const resign = async (
  identity: Identity,
  msg: ClientResign,
  { rooms, connections, archive, users, log }: Ports,
): Promise<void> => {
  const room = await rooms.get(msg.roomId);
  if (room === undefined) {
    await sendError(connections, identity, 'room not found', 'resign');
    return;
  }
  const color = colorOf(room, identity.playerId);
  if (color === undefined) {
    await sendError(connections, identity, 'not in room', 'resign');
    return;
  }
  // Both players resigning inside one round trip is a race nobody loses
  // twice: answer the late one with the result rather than an error, which
  // the client treats as fatal and leaves the finished board over.
  if (room.state.status === 'finished') {
    await connections.sendTo(identity.playerId, {
      type: 'stateUpdated',
      roomId: room.id,
      state: toWire(room.state),
    });
    return;
  }
  // An empty seat cannot be awarded a win. The UI routes a solo room to
  // cancelRoom; this is the guard for anything else on the wire.
  if (!isFull(room)) {
    await sendError(connections, identity, 'no opponent to resign to', 'resign');
    return;
  }

  const updated = touch({ ...room, state: resignGame(room.state, color) }, new Date());
  await rooms.save(updated);
  await connections.broadcast(updated.id, {
    type: 'stateUpdated',
    roomId: updated.id,
    state: toWire(updated.state),
  });

  // Same terms as makeMove: the resignation stands whether or not the archive
  // takes it, and the sweep retries what this drops.
  try {
    await archiveFinished(updated, { archive, users });
  } catch (err) {
    log.error({ roomId: updated.id, err }, 'archiving a resigned game failed');
  }
};
