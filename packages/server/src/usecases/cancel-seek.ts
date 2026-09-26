import type { Identity } from '../domain/identity.js';
import type { SeekStore } from '../domain/seek-store.js';

export type CancelSeekResult = 'cancelled' | 'not-found' | 'forbidden';

export const cancelSeek = async (
  identity: Identity,
  seekId: string,
  seeks: SeekStore,
): Promise<CancelSeekResult> => {
  const seek = await seeks.get(seekId);
  if (seek === undefined) return 'not-found';
  if (seek.seeker.playerId !== identity.playerId) return 'forbidden';

  // Claim rather than a plain delete: someone pairing with it between the read
  // and here has already taken it, and the cancel has to lose that race.
  return (await seeks.claim(seekId)) === undefined ? 'not-found' : 'cancelled';
};
