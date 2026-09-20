import { IllegalMoveError, applyMove } from '@termitary/engine';
import type { ClientMakeMove } from '@termitary/protocol';
import { fromWireMove, toWire } from '@termitary/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { type Room, colorOf, touch } from '../domain/room.js';
import { archiveFinished } from './archive-finished.js';
import { retryOnConflict } from './retry-on-conflict.js';
import { sendError } from './send-error.js';

export const makeMove = (identity: Identity, msg: ClientMakeMove, ports: Ports): Promise<void> =>
  retryOnConflict(() => attemptMove(identity, msg, ports));

const attemptMove = async (
  identity: Identity,
  msg: ClientMakeMove,
  { rooms, connections, archive, users, log }: Ports,
): Promise<void> => {
  const current = await rooms.getForUpdate(msg.roomId);
  if (current === undefined) {
    await sendError(connections, identity, 'room not found', 'makeMove');
    return;
  }
  const { value: room, version } = current;
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

  let played: Room;
  try {
    played = { ...room, state: applyMove(room.state, fromWireMove(msg.move)) };
  } catch (err) {
    const message = err instanceof IllegalMoveError ? err.message : 'illegal move';
    await sendError(connections, identity, message, 'makeMove');
    return;
  }

  const updated = touch(played, new Date());
  await rooms.save(updated, version);
  await connections.broadcast(updated.id, {
    type: 'stateUpdated',
    roomId: updated.id,
    state: toWire(updated.state),
  });

  // The move is committed and both players have seen it, so a failed archive
  // is not theirs to hear about. The sweep archives before it deletes.
  try {
    await archiveFinished(updated, { archive, users });
  } catch (err) {
    log.error({ roomId: updated.id, err }, 'archiving a finished game failed');
  }
};
