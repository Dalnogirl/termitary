import type { ClientClaimTimeout } from '@termitary/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { colorOf } from '../domain/room.js';
import { answerMissingRoom } from './answer-missing-room.js';
import { stateUpdate } from './broadcast-state.js';
import { endIfOutOfTime } from './end-on-time.js';
import { type TimeDeps, arrivalOf } from './now.js';
import { retryOnConflict } from './retry-on-conflict.js';
import { sendError } from './send-error.js';

export const claimTimeout = (
  identity: Identity,
  msg: ClientClaimTimeout,
  ports: Ports,
  deps: TimeDeps = {},
): Promise<void> => {
  const now = arrivalOf(deps);
  return retryOnConflict(() => attemptClaim(identity, msg, ports, now));
};

const attemptClaim = async (
  identity: Identity,
  msg: ClientClaimTimeout,
  ports: Ports,
  now: Date,
): Promise<void> => {
  const current = await ports.rooms.getForUpdate(msg.roomId);
  if (current === undefined) {
    await answerMissingRoom(identity, msg.roomId, 'claimTimeout', ports);
    return;
  }
  const { value: room, version } = current;
  if (colorOf(room, identity.playerId) === undefined) {
    await sendError(ports.connections, identity, 'not in room', 'claimTimeout');
    return;
  }
  if ((await endIfOutOfTime(room, version, identity, 'claimTimeout', now, ports)) !== 'in-time') {
    return;
  }
  // The claimant's countdown ran ahead of the server's; this puts it back.
  await ports.connections.sendTo(identity.playerId, stateUpdate(room, now));
};
