import { EXPANSION_PIECES, type Ruleset, rulesetFor } from '@termitary/engine';
import type { SeekPreference } from '@termitary/protocol';
import type { Identity } from './identity.js';

/** A private seek is reachable by its link only: never listed, never matched. */
export type SeekVisibility = 'pool' | 'private';

/**
 * A standing offer to play. It carries no `GameState` and no seats, so nothing
 * a player could sit in exists until pairing writes the room.
 */
export type Seek = {
  readonly id: string;
  readonly seeker: Identity;
  readonly preference: SeekPreference;
  readonly visibility: SeekVisibility;
  readonly createdAt: Date;
  readonly expiresAt: Date;
};

export const SEEK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** How many outstanding seeks one player may hold, private and pool together. */
export const MAX_OUTSTANDING_SEEKS = 5;

export const createSeek = (
  id: string,
  seeker: Identity,
  preference: SeekPreference,
  visibility: SeekVisibility,
  now: Date,
): Seek => ({
  id,
  seeker,
  preference,
  visibility,
  createdAt: now,
  expiresAt: new Date(now.getTime() + SEEK_TTL_MS),
});

export const isExpired = (seek: Seek, now: Date): boolean => seek.expiresAt <= now;

export const compatible = (a: SeekPreference, b: SeekPreference): boolean =>
  EXPANSION_PIECES.every(
    (piece) =>
      !(a[piece] === 'require' && b[piece] === 'exclude') &&
      !(b[piece] === 'require' && a[piece] === 'exclude'),
  );

// The union of both demands, which needs no tie-break: `compatible` has
// already ruled out a piece one side requires and the other excludes, so
// every member of the union is acceptable to both.
export const pairedRuleset = (a: SeekPreference, b: SeekPreference): Ruleset =>
  rulesetFor(EXPANSION_PIECES.filter((piece) => a[piece] === 'require' || b[piece] === 'require'));
