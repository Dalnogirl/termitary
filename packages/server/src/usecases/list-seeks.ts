import type { SeekBoardDto, SeekDto } from '@termitary/protocol';
import type { Identity } from '../domain/identity.js';
import type { SeekStore } from '../domain/seek-store.js';
import type { Seek } from '../domain/seek.js';

export const toSeekDto = (seek: Seek): SeekDto => ({
  seekId: seek.id,
  preference: seek.preference,
  createdAt: seek.createdAt.getTime(),
});

// Split rather than flagged: the lobby renders your own seek with a cancel
// action and everyone else's with a click-to-pair, so the split is the thing
// the page already needs.
export const listSeeks = async (
  identity: Identity,
  seeks: SeekStore,
  now: Date = new Date(),
): Promise<SeekBoardDto> => {
  const mine = await seeks.getFor(identity.playerId, now);
  return {
    mine: mine === undefined ? null : toSeekDto(mine),
    pool: (await seeks.listPool(identity.playerId, now)).map(toSeekDto),
  };
};
