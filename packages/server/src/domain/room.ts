import { type GameState, createGame } from '@hive/engine';
import type { Color } from '@hive/engine';
import type { Identity } from './identity.js';

export type Seats = Readonly<Record<Color, Identity | undefined>>;

export type Room = {
  readonly id: string;
  readonly state: GameState;
  readonly players: Seats;
};

// White is the first seat filled, which makes the room creator white.
const SEAT_ORDER = ['white', 'black'] as const;

export const createRoom = (id: string, creator: Identity): Room => ({
  id,
  state: createGame(),
  players: { white: creator, black: undefined },
});

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

export const seatPlayer = (room: Room, joiner: Identity): Room => {
  const free = SEAT_ORDER.find((color) => room.players[color] === undefined);
  return free === undefined ? room : { ...room, players: { ...room.players, [free]: joiner } };
};

export const unseatPlayer = (room: Room, playerId: string): Room => {
  const color = colorOf(room, playerId);
  return color === undefined ? room : { ...room, players: { ...room.players, [color]: undefined } };
};

export const currentPlayerIdentity = (room: Room): Identity | undefined =>
  room.state.status === 'finished' ? undefined : room.players[room.state.currentPlayer];
