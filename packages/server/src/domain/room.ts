import { type GameState, createGame } from '@hive/engine';
import type { Color } from '@hive/engine';
import type { Identity } from './identity.js';

export type Room = {
  readonly id: string;
  readonly state: GameState;
  readonly players: readonly [Identity | undefined, Identity | undefined];
};

const colorIndex = (color: Color): 0 | 1 => (color === 'white' ? 0 : 1);

export const createRoom = (id: string, creator: Identity): Room => ({
  id,
  state: createGame(),
  players: [creator, undefined],
});

export const isFull = (room: Room): boolean =>
  room.players[0] !== undefined && room.players[1] !== undefined;

export const colorOf = (room: Room, playerId: string): Color | undefined => {
  if (room.players[0]?.playerId === playerId) return 'white';
  if (room.players[1]?.playerId === playerId) return 'black';
  return undefined;
};

export const otherPlayer = (room: Room, playerId: string): Identity | undefined => {
  const [w, b] = room.players;
  if (w?.playerId === playerId) return b;
  if (b?.playerId === playerId) return w;
  return undefined;
};

export const seatPlayer = (room: Room, joiner: Identity): Room => {
  const [w, b] = room.players;
  if (w === undefined) return { ...room, players: [joiner, b] };
  if (b === undefined) return { ...room, players: [w, joiner] };
  return room;
};

export const unseatPlayer = (room: Room, playerId: string): Room => ({
  ...room,
  players: [
    room.players[0]?.playerId === playerId ? undefined : room.players[0],
    room.players[1]?.playerId === playerId ? undefined : room.players[1],
  ],
});

export const currentPlayerIdentity = (room: Room): Identity | undefined =>
  room.state.status === 'finished' ? undefined : room.players[colorIndex(room.state.currentPlayer)];
