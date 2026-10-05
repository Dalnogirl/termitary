import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { type Room, finishedOnTime } from '../domain/room.js';
import { broadcastState } from './broadcast-state.js';
import { commitPlayed } from './commit-played.js';
import { sendError } from './send-error.js';

type FlagOutcome = 'in-time' | 'finished' | 'archive-failed';

/**
 * Finishes the game if the side to move ran out of time by `now`, whoever
 * asked. The request that noticed is not carried out: the game ended before
 * it arrived.
 */
export const finishIfFlagged = async (
  room: Room,
  version: number,
  identity: Identity,
  requestKind: string,
  now: Date,
  ports: Ports,
): Promise<FlagOutcome> => {
  const finished = finishedOnTime(room, now);
  if (finished === undefined) return 'in-time';
  if ((await commitPlayed(finished, version, ports)) === 'archive-failed') {
    await sendError(ports.connections, identity, 'could not finish the game', requestKind);
    return 'archive-failed';
  }
  await broadcastState(ports.connections, finished, now);
  return 'finished';
};
