import type { ClientClaimTimeout } from '@termitary/protocol';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { colorOf } from '../domain/room.js';
import { answerMissingRoom } from './answer-missing-room.js';
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
  // A claim the clock does not bear out is dropped without a word. A resync here
  // would carry the position, and roll back a reply the claimant has in flight.
  await endIfOutOfTime(room, version, identity, 'claimTimeout', now, ports);
};
