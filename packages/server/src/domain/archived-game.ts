import type { Color, EndReason, GameState } from '@termitary/engine';
import type { FinishedRoom } from './room.js';

type FinishedState = Extract<GameState, { status: 'finished' }>;

// The name is snapshotted at archive time and never refreshed: deleting an
// account nulls the seat's foreign key, and the history it played in is the
// other player's too. So a seat can keep a name after losing its id.
export type ArchivedPlayer = {
  readonly playerId: string | undefined;
  readonly name: string | undefined;
};

export type ArchivedSeats = Readonly<Record<Color, ArchivedPlayer | undefined>>;

// What a listing needs, for the same reason `RoomOverview` exists: no caller
// browsing a player's history should deserialize a game per row.
export type ArchivedGameOverview = {
  readonly id: string;
  readonly players: ArchivedSeats;
  readonly result: FinishedState['result'];
  readonly endReason: EndReason;
  readonly startedAt: Date;
  readonly finishedAt: Date;
  readonly moveCount: number;
};

export type ArchivedGame = ArchivedGameOverview & {
  readonly state: FinishedState;
};

const player = (
  identity: { readonly playerId: string } | undefined,
  names: ReadonlyMap<string, string>,
): ArchivedPlayer | undefined =>
  identity === undefined
    ? undefined
    : { playerId: identity.playerId, name: names.get(identity.playerId) };

export const seatIds = (room: FinishedRoom): readonly string[] =>
  [room.players.white, room.players.black]
    .filter((seat) => seat !== undefined)
    .map((seat) => seat.playerId);

export const toArchivedGame = (
  room: FinishedRoom,
  names: ReadonlyMap<string, string>,
): ArchivedGame => ({
  id: room.id,
  players: {
    white: player(room.players.white, names),
    black: player(room.players.black, names),
  },
  result: room.state.result,
  endReason: room.state.endReason,
  startedAt: room.createdAt,
  finishedAt: room.updatedAt,
  moveCount: room.state.history.length,
  state: room.state,
});
