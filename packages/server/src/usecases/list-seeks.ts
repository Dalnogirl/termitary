import type { SeekBoardDto, SeekDto } from '@termitary/protocol';
import type { Identity } from '../domain/identity.js';
import type { SeekStore } from '../domain/seek-store.js';
import type { Seek } from '../domain/seek.js';

export const toSeekDto = (seek: Seek): SeekDto => ({
  seekId: seek.id,
  preference: seek.preference,
  createdAt: seek.createdAt.getTime(),
});

// Two lists rather than one flagged list: the lobby renders your own seek with
// a cancel action and everyone else's with a click-to-pair, so the split is
// the thing the page already needs.
export const listSeeks = async (
  identity: Identity,
  seeks: SeekStore,
  now: Date = new Date(),
): Promise<SeekBoardDto> => ({
  mine: (await seeks.listFor(identity.playerId, now)).map(toSeekDto),
  pool: (await seeks.listPool(identity.playerId, now)).map(toSeekDto),
});
