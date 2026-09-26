import { BASE_RULESET, type GameState, type Ruleset, createGame } from '@termitary/engine';
import type { Color } from '@termitary/engine';
import type { Identity } from './identity.js';

export type Seats = Readonly<Record<Color, Identity | undefined>>;

export type Room = {
  readonly id: string;
  readonly ruleset: Ruleset;
  readonly state: GameState;
  readonly players: Seats;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

export type FinishedRoom = Room & { readonly state: Extract<GameState, { status: 'finished' }> };

export const isFinished = (room: Room): room is FinishedRoom => room.state.status === 'finished';

const SEAT_ORDER = ['white', 'black'] as const;

// Both seats filled from the start. Pairing is the only way a room comes to
// exist, so there is no window where one side is empty.
export const createPairedRoom = (
  id: string,
  white: Identity,
  black: Identity,
  now: Date,
  ruleset: Ruleset = BASE_RULESET,
): Room => ({
  id,
  ruleset,
  state: createGame(ruleset),
  players: { white, black },
  createdAt: now,
  updatedAt: now,
});

// Stores write `updatedAt` as given, so anything that should move a room in
// the lobby ordering or out of the sweep's reach has to say so here.
export const touch = (room: Room, now: Date): Room => ({ ...room, updatedAt: now });

export const isFull = (room: Room): boolean =>
  room.players.white !== undefined && room.players.black !== undefined;

export const seatOf = (players: Seats, playerId: string): Color | undefined =>
  SEAT_ORDER.find((color) => players[color]?.playerId === playerId);

export const colorOf = (room: Room, playerId: string): Color | undefined =>
  seatOf(room.players, playerId);

export const otherPlayer = (room: Room, playerId: string): Identity | undefined => {
  const color = colorOf(room, playerId);
  return color === undefined ? undefined : room.players[color === 'white' ? 'black' : 'white'];
};

export const currentPlayerIdentity = (room: Room): Identity | undefined =>
  room.state.status === 'finished' ? undefined : room.players[room.state.currentPlayer];
