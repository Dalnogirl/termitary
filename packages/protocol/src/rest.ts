import type { WireGameState } from './wire.js';

// REST bodies. Plain types, no zod: nothing untrusted crosses these. The
// server has no REST request body to parse, and both sides import the same
// declaration, so responses are checked at compile time.
export type RoomSummaryDto = {
  readonly roomId: string;
  readonly playerCount: 0 | 1 | 2;
  readonly status: 'in_progress' | 'finished';
};

export type CreateRoomResponseDto = {
  readonly roomId: string;
};

// A room the caller holds a seat in. Every row is in progress and seated by
// construction, so there is no `status` and `seat` is never null.
export type MyRoomSummaryDto = {
  readonly roomId: string;
  readonly seat: 'white' | 'black';
  readonly playerCount: 1 | 2;
  /** Epoch milliseconds, rendered as a relative time. */
  readonly updatedAt: number;
};

// A keyset page. `nextCursor` is the cursor for the page after this one, and
// is absent on the last page; it is opaque, and only ever handed back as-is.
export type Page<T> = {
  readonly items: readonly T[];
  readonly nextCursor?: string;
};

/** Display names, snapshotted when the game was archived. Null once nobody held the seat. */
export type ArchivedSeatNamesDto = {
  readonly white: string | null;
  readonly black: string | null;
};

// A row is served from one player's side: `seat` is the seat that player held
// in the game, never null, exactly as `MyRoomSummaryDto.seat` is not. On a
// profile listing that player is the profile owner, not the caller.
export type ArchivedGameSummaryDto = {
  readonly gameId: string;
  readonly seat: 'white' | 'black';
  readonly players: ArchivedSeatNamesDto;
  readonly result: 'white-wins' | 'black-wins' | 'draw';
  readonly endReason: 'queen-surrounded' | 'resignation';
  /** Epoch milliseconds. */
  readonly startedAt: number;
  /** Epoch milliseconds. */
  readonly finishedAt: number;
  readonly moveCount: number;
};

// The whole game, so a replay needs no second call: `state.history` is what
// the scrub controls fold back into positions.
export type ArchivedGameDetailDto = ArchivedGameSummaryDto & {
  readonly state: WireGameState;
};

/** Every count is over finished games only; a game in progress is in no record. */
export type SeatRecordDto = {
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  /** Wins over games played, three decimals. Zero for a player who has finished nothing. */
  readonly winRate: number;
};

// The white/black split is two samples of the same player and says less than it
// looks like it does; it is here because the scan that fills the rest already
// has it.
export type PlayerRecordDto = {
  readonly overall: SeatRecordDto;
  readonly asWhite: SeatRecordDto;
  readonly asBlack: SeatRecordDto;
  /** Plies, not move pairs, matching `ArchivedGameSummaryDto.moveCount`. */
  readonly averageMoves: number;
  readonly endings: {
    readonly queenSurrounded: number;
    readonly resignation: number;
  };
  /** Consecutive wins by finish order. A draw breaks it. */
  readonly longestWinStreak: number;
  /** Epoch milliseconds, null until a first game finishes. */
  readonly lastPlayedAt: number | null;
};

// Public to any signed-in player, so it carries nothing the owner would not
// show a stranger: no email, no id beyond the one already in the URL.
export type ProfileDto = {
  readonly userId: string;
  readonly name: string;
  /** Epoch milliseconds. When the profile was created, not the account. */
  readonly memberSince: number;
  readonly record: PlayerRecordDto;
};
