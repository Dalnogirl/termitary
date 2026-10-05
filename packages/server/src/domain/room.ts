import {
  type Clock,
  type TimeControl,
  abandoned,
  charge,
  firstMoveRemaining,
  flagged,
  remaining,
  startClock,
} from '@termitary/clock';
import {
  BASE_RULESET,
  type GameState,
  type Move,
  type Ruleset,
  applyMove,
  createGame,
  timeOut,
} from '@termitary/engine';
import type { Color } from '@termitary/engine';
import type { Identity } from './identity.js';

export type Seats = Readonly<Record<Color, Identity>>;

export type Room = {
  readonly id: string;
  readonly ruleset: Ruleset;
  readonly state: GameState;
  readonly players: Seats;
  readonly clock: Clock;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type FinishedRoom = Room & { readonly state: Extract<GameState, { status: 'finished' }> };

export const isFinished = (room: Room): room is FinishedRoom => room.state.status === 'finished';

const SEAT_ORDER = ['white', 'black'] as const;

export const UNTIMED: TimeControl = { kind: 'untimed' };

// Both seats filled from the start. Pairing is the only way a room comes to
// exist, so there is no window where one side is empty.
export const createPairedRoom = (
  id: string,
  white: Identity,
  black: Identity,
  now: Date,
  ruleset: Ruleset = BASE_RULESET,
  timeControl: TimeControl = UNTIMED,
): Room => ({
  id,
  ruleset,
  state: createGame(ruleset),
  players: { white, black },
  clock: startClock(timeControl, now.getTime()),
  createdAt: now,
  updatedAt: now,
});

// Stores write `updatedAt` as given, so anything that should move a room in
// the lobby ordering, or stamp when its game finished, has to say so here.
export const touch = (room: Room, now: Date): Room => ({ ...room, updatedAt: now });

/**
 * Plays `color`'s move and charges their clock for it. A forced pass that
 * `applyMove` appended is charged too, at the same instant, or the clock would
 * hand the turn to the side the game just handed it back from.
 */
export const play = (room: Room, color: Color, move: Move, now: Date): Room => {
  const state = applyMove(room.state, move);
  const at = now.getTime();
  const charged = charge(room.clock, color, at);
  const passedBack = state.status === 'in_progress' && state.currentPlayer === color;
  const clock = passedBack ? charge(charged, charged.toMove, at) : charged;
  return touch({ ...room, state, clock }, now);
};

// A missed first move loses on time until #185 turns it into an abort.
const outOfTime = (room: Room, now: Date): Color | undefined =>
  room.state.status === 'finished'
    ? undefined
    : (flagged(room.clock, now.getTime()) ?? abandoned(room.clock, now.getTime()));

// When the side to move runs out, which can be long before anyone notices.
// Infinite on an untimed clock.
const deadlineMsOf = (clock: Clock): number => {
  const start = clock.turnStartedAt;
  const window = firstMoveRemaining(clock, start);
  return start + (Number.isFinite(window) ? window : remaining(clock, clock.toMove, start));
};

/** When the game ends on time if nobody moves, or undefined when it never will. */
export const deadlineOf = (room: Room): Date | undefined => {
  if (room.state.status === 'finished') return undefined;
  const ms = deadlineMsOf(room.clock);
  return Number.isFinite(ms) ? new Date(ms) : undefined;
};

/**
 * The room finished on time, or undefined while the side to move has time
 * left. Stamped at the deadline rather than at `now`, so the archive records
 * when the game ended, not when someone came back to it.
 */
export const finishedOnTime = (room: Room, now: Date): Room | undefined => {
  const loser = outOfTime(room, now);
  if (loser === undefined) return undefined;
  const endedAt = new Date(Math.min(now.getTime(), deadlineMsOf(room.clock)));
  return touch({ ...room, state: timeOut(room.state, loser) }, endedAt);
};

export const seatOf = (players: Seats, playerId: string): Color | undefined =>
  SEAT_ORDER.find((color) => players[color].playerId === playerId);

export const colorOf = (room: Room, playerId: string): Color | undefined =>
  seatOf(room.players, playerId);

export const playerAcross = (room: Room, color: Color): Identity =>
  room.players[color === 'white' ? 'black' : 'white'];

export const otherPlayer = (room: Room, playerId: string): Identity | undefined => {
  const color = colorOf(room, playerId);
  return color === undefined ? undefined : playerAcross(room, color);
};

export const currentPlayerIdentity = (room: Room): Identity | undefined =>
  room.state.status === 'finished' ? undefined : room.players[room.state.currentPlayer];
