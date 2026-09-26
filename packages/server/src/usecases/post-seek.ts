import { randomUUID } from 'node:crypto';
import type { Color } from '@termitary/engine';
import { type SeekPreference, SeekPreferenceSchema } from '@termitary/protocol';
import { z } from 'zod';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { createPairedRoom } from '../domain/room.js';
import { SeekerAlreadySeekingError } from '../domain/seek-store.js';
import { type Seek, compatible, createSeek, isExpired, pairedRuleset } from '../domain/seek.js';

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
  | { readonly outcome: 'gone' }
  | { readonly outcome: 'incompatible' }
  | { readonly outcome: 'own-seek' };

/** Picks white's player. An argument so tests can fix the flip. */
export type SeatPicker = () => Color;

export const coinFlip: SeatPicker = () => (Math.random() < 0.5 ? 'white' : 'black');

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
  // Pairing ends this player's search, so their own seek comes off the board
  // too. Without it a player who clicked a listing while holding a seek would
  // be in a game and still advertising for another.
  await seeks.deleteFor(me.playerId);
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

/**
 * The one way into a game: pair now if anything fits, otherwise stand a seek
 * on the board. Clicking a listed seek is the same call carrying its id.
 *
 * Only `claim` is atomic, so simultaneous posts by two players can both read
 * an empty pool and both end up waiting. That costs a row apiece and recovers
 * on its own the moment either clicks the other's listing. Closing it means a
 * transaction spanning both stores, which is the guarantee #50's adapters
 * cannot make. One seek per player is not left to that: the unique index on
 * `seeker_user_id` holds it however the requests interleave.
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

  // A player holds one seek, so a second post replaces the first rather than
  // being refused. Wanting two sets of terms is wanting looser terms, and the
  // pool walk above has already tried them against everything waiting.
  await ports.seeks.deleteFor(identity.playerId);

  const seek = createSeek((deps.newId ?? randomUUID)(), identity, preference, 'pool', now);
  try {
    await ports.seeks.create(seek);
  } catch (err) {
    if (!(err instanceof SeekerAlreadySeekingError)) throw err;
    // Two posts from the same player at once. The index picked a winner, and
    // that seek is the honest answer: the caller wanted one on the board and
    // there is one on the board.
    const standing = await ports.seeks.getFor(identity.playerId, now);
    if (standing === undefined) throw err;
    return { outcome: 'waiting', seek: standing };
  }
  return { outcome: 'waiting', seek };
};
