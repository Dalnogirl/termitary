import { resign as resignGame } from '@termitary/engine';
import type { ClientResign } from '@termitary/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { colorOf, touch } from '../domain/room.js';
import { answerMissingRoom } from './answer-missing-room.js';
import { broadcastState } from './broadcast-state.js';
import { commitPlayed } from './commit-played.js';
import { finishIfFlagged } from './finish-on-time.js';
import { type TimeDeps, arrivalOf } from './now.js';
import { retryOnConflict } from './retry-on-conflict.js';
import { sendError } from './send-error.js';

export const resign = (
  identity: Identity,
  msg: ClientResign,
  ports: Ports,
  deps: TimeDeps = {},
): Promise<void> => {
  const now = arrivalOf(deps);
  return retryOnConflict(() => attemptResign(identity, msg, ports, now));
};

const attemptResign = async (
  identity: Identity,
  msg: ClientResign,
  ports: Ports,
  now: Date,
): Promise<void> => {
  const { rooms, connections } = ports;
  // Also the late half of two players resigning inside one round trip: the
  // first one's commit has already archived the game and taken the room.
  const current = await rooms.getForUpdate(msg.roomId);
  if (current === undefined) {
    await answerMissingRoom(identity, msg.roomId, 'resign', ports);
    return;
  }
  const { value: room, version } = current;
  const color = colorOf(room, identity.playerId);
  if (color === undefined) {
    await sendError(connections, identity, 'not in room', 'resign');
    return;
  }
  if (room.state.status === 'finished') {
    await sendError(connections, identity, 'game already finished', 'resign');
    return;
  }
  if ((await finishIfFlagged(room, version, identity, 'resign', now, ports)) !== 'in-time') {
    return;
  }
  const updated = touch({ ...room, state: resignGame(room.state, color) }, now);
  if ((await commitPlayed(updated, version, ports)) === 'archive-failed') {
    await sendError(connections, identity, 'could not finish the game', 'resign');
    return;
  }
  await broadcastState(connections, updated, now);
};
