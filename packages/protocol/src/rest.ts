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
