import { IllegalMoveError } from '@termitary/engine';
import type { ClientMakeMove } from '@termitary/protocol';
import { fromWireMove } from '@termitary/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { type Room, colorOf, play } from '../domain/room.js';
import { answerMissingRoom } from './answer-missing-room.js';
import { broadcastState } from './broadcast-state.js';
import { commitPlayed } from './commit-played.js';
import { endIfOutOfTime } from './end-on-time.js';
import { type TimeDeps, arrivalOf } from './now.js';
import { retryOnConflict } from './retry-on-conflict.js';
import { sendError } from './send-error.js';

// Read once, outside the retry: a move that loses a race arrived when it
// arrived, and its re-run judges it against the same instant.
export const makeMove = (
  identity: Identity,
  msg: ClientMakeMove,
  ports: Ports,
  deps: TimeDeps = {},
): Promise<void> => {
  const now = arrivalOf(deps);
  return retryOnConflict(() => attemptMove(identity, msg, ports, now));
};

const attemptMove = async (
  identity: Identity,
  msg: ClientMakeMove,
  ports: Ports,
  now: Date,
): Promise<void> => {
  const { rooms, connections } = ports;
  const current = await rooms.getForUpdate(msg.roomId);
  if (current === undefined) {
    await answerMissingRoom(identity, msg.roomId, 'makeMove', ports);
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
  if ((await endIfOutOfTime(room, version, identity, 'makeMove', now, ports)) !== 'in-time') {
    return;
  }
  if (room.state.currentPlayer !== color) {
    await sendError(connections, identity, 'not your turn', 'makeMove');
    return;
  }

  let updated: Room;
  try {
    updated = play(room, color, fromWireMove(msg.move), now);
  } catch (err) {
    if (!(err instanceof IllegalMoveError)) throw err;
    await sendError(connections, identity, err.message, 'makeMove');
    return;
  }

  if ((await commitPlayed(updated, version, ports)) === 'archive-failed') {
    await sendError(connections, identity, 'could not finish the game', 'makeMove');
    return;
  }
  await broadcastState(connections, updated, now);
};
