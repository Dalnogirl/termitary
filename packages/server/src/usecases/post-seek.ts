import { randomUUID } from 'node:crypto';
import { type SeekPreference, SeekPreferenceSchema } from '@termitary/protocol';
import { z } from 'zod';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { createPairedRoom } from '../domain/room.js';
import type { SeekStore } from '../domain/seek-store.js';
import {
  MAX_OUTSTANDING_SEEKS,
  type Seek,
  compatible,
  createSeek,
  isExpired,
  pairedRuleset,
} from '../domain/seek.js';
import type { SeatPicker } from './create-room.js';
import { coinFlip } from './create-room.js';

export const PostSeekBodySchema = z.object({
  // Absent is the default seek: no opinion on any expansion, pairs with
  // anything. The web's disclosure is what fills this in.
  preference: SeekPreferenceSchema.optional(),
  /** Set when the player clicked one seek on the board instead of the Play button. */
  seekId: z.string().min(1).optional(),
});
export type PostSeekBody = z.infer<typeof PostSeekBodySchema>;

export type PostSeekResult =
  | { readonly outcome: 'paired'; readonly roomId: string }
  | { readonly outcome: 'waiting'; readonly seek: Seek }
  | { readonly outcome: 'at-limit' }
  | { readonly outcome: 'gone' }
  | { readonly outcome: 'incompatible' }
  | { readonly outcome: 'own-seek' };

export type SeekPorts = Pick<Ports, 'rooms' | 'seeks' | 'log'>;

/** Everything nondeterministic, so a test can fix all three. */
export type PairingDeps = {
  readonly newId?: () => string;
  readonly pickSeat?: SeatPicker;
  readonly clock?: () => Date;
};

const pairInto = async (
  me: Identity,
  mine: SeekPreference,
  claimed: Seek,
  { rooms, seeks, log }: SeekPorts,
  deps: PairingDeps,
  now: Date,
): Promise<string> => {
  const newId = deps.newId ?? randomUUID;
  const ruleset = pairedRuleset(mine, claimed.preference);
  const [white, black] =
    (deps.pickSeat ?? coinFlip)() === 'white' ? [me, claimed.seeker] : [claimed.seeker, me];
  const room = createPairedRoom(newId(), white, black, now, ruleset);

  try {
    await rooms.create(room);
  } catch (err) {
    // The claim already deleted the seek. Without this the opponent loses
    // their place on the board and is told nothing, since they are not the
    // one holding the failed request. Restored rather than transacted: #50
    // swaps these two stores for adapters with no transaction between them.
    try {
      await seeks.create(claimed);
    } catch (restoreErr) {
      // Whatever took the room write down is the likely reason this failed
      // too, so it is the error worth raising. The lost seek only gets a line.
      log.error({ err: restoreErr, seekId: claimed.id }, 'could not restore claimed seek');
    }
    throw err;
  }
  return room.id;
};

/**
 * Walks the pool oldest first and pairs with the first seek it can take.
 * A lost claim is not retried against the same row: someone else already has
 * it, so the walk moves to the next candidate and gives up when the list runs
 * out. Falling through to a posted seek is the right answer then, because the
 * player who beat us to every candidate will pair with what we post.
 */
const pairFromPool = async (
  me: Identity,
  mine: SeekPreference,
  ports: SeekPorts,
  deps: PairingDeps,
  now: Date,
): Promise<string | undefined> => {
  for (const candidate of await ports.seeks.listPool(me.playerId, now)) {
    if (!compatible(mine, candidate.preference)) continue;
    const claimed = await ports.seeks.claim(candidate.id);
    if (claimed === undefined) continue;
    return pairInto(me, mine, claimed, ports, deps, now);
  }
  return undefined;
};

const claimOne = async (
  me: Identity,
  mine: SeekPreference,
  seekId: string,
  ports: SeekPorts,
  deps: PairingDeps,
  now: Date,
): Promise<PostSeekResult> => {
  const target = await ports.seeks.get(seekId);
  if (target === undefined || isExpired(target, now)) return { outcome: 'gone' };
  if (target.seeker.playerId === me.playerId) return { outcome: 'own-seek' };
  if (!compatible(mine, target.preference)) return { outcome: 'incompatible' };

  const claimed = await ports.seeks.claim(seekId);
  // Lost the race between the read and the claim, which is the whole reason
  // `claim` deletes and returns rather than the caller reading and deleting.
  if (claimed === undefined) return { outcome: 'gone' };

  return { outcome: 'paired', roomId: await pairInto(me, mine, claimed, ports, deps, now) };
};

const atLimit = async (seeks: SeekStore, playerId: string, now: Date): Promise<boolean> =>
  (await seeks.countFor(playerId, now)) >= MAX_OUTSTANDING_SEEKS;

/**
 * The one way into a game: pair now if anything fits, otherwise stand a seek
 * on the board. Clicking a listed seek is the same call carrying its id.
 *
 * Only `claim` is atomic. Two accepted consequences: simultaneous posts can
 * both read an empty pool and both end up waiting, and the cap can be
 * overshot by a burst from one player. Both cost a row that expires in seven
 * days, and the first recovers on its own the moment either player clicks the
 * other's listing. Closing them means a transaction spanning both stores,
 * which is the guarantee #50's adapters cannot make.
 */
export const postSeek = async (
  identity: Identity,
  body: PostSeekBody,
  ports: SeekPorts,
  deps: PairingDeps = {},
): Promise<PostSeekResult> => {
  const now = (deps.clock ?? (() => new Date()))();
  const preference = body.preference ?? {};

  if (body.seekId !== undefined) {
    return claimOne(identity, preference, body.seekId, ports, deps, now);
  }

  const roomId = await pairFromPool(identity, preference, ports, deps, now);
  if (roomId !== undefined) return { outcome: 'paired', roomId };

  // Checked after the match, not before: pairing writes no seek and takes one
  // off the board, so refusing a player their sixth game because they are
  // holding five unmatched seeks would refuse a game that was already there.
  if (await atLimit(ports.seeks, identity.playerId, now)) return { outcome: 'at-limit' };

  const seek = createSeek((deps.newId ?? randomUUID)(), identity, preference, 'pool', now);
  await ports.seeks.create(seek);
  return { outcome: 'waiting', seek };
};
