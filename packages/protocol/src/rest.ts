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
