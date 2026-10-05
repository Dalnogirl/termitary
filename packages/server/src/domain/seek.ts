import type { CorrespondenceControl, UntimedControl } from '@termitary/clock';
import { EXPANSION_PIECES, type Ruleset, rulesetFor } from '@termitary/engine';
import type { SeekPreference } from '@termitary/protocol';
import type { Identity } from './identity.js';

/** A private seek is reachable by its link only: never listed, never matched. */
export type SeekVisibility = 'pool' | 'private';

/** Real-time seeks are the lobby's in-memory pool (#190), so a stored seek never holds one. */
export type SeekTimeControl = UntimedControl | CorrespondenceControl;

export const UNTIMED_SEEK: SeekTimeControl = { kind: 'untimed' };

/**
 * A standing offer to play. It carries no `GameState` and no seats, so nothing
 * a player could sit in exists until pairing writes the room.
 */
export type Seek = {
  readonly id: string;
  readonly seeker: Identity;
  readonly preference: SeekPreference;
  readonly visibility: SeekVisibility;
  readonly timeControl: SeekTimeControl;
  readonly createdAt: Date;
  readonly expiresAt: Date;
};

export const SEEK_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const createSeek = (
  id: string,
  seeker: Identity,
  preference: SeekPreference,
  visibility: SeekVisibility,
  now: Date,
  timeControl: SeekTimeControl = UNTIMED_SEEK,
): Seek => ({
  id,
  seeker,
  preference,
  visibility,
  timeControl,
  createdAt: now,
  expiresAt: new Date(now.getTime() + SEEK_TTL_MS),
});

export const isExpired = (seek: Seek, now: Date): boolean => seek.expiresAt <= now;

// Exact, with no "either": a seek holds one time control, and auto-match never
// picks a clock for someone who asked for another.
export const sameTimeControl = (a: SeekTimeControl, b: SeekTimeControl): boolean =>
  a.kind === 'correspondence'
    ? b.kind === 'correspondence' && a.daysPerMove === b.daysPerMove
    : a.kind === b.kind;

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
