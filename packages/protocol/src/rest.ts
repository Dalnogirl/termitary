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

// Only games the caller played are ever served, so `seat` is theirs and is
// never null, exactly as `MyRoomSummaryDto.seat` is not.
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
