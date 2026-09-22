import { z } from 'zod';
import type { SeekPreference } from './seek-preference.js';
import type { WireGameState, WireRuleset } from './wire.js';

// REST bodies. Responses are plain types: both sides import the same
// declaration, so the compiler checks them. A request body is input nobody
// controls, so the field schemas it is built from live here and the object the
// route parses is assembled next to the use case that takes it.
export type RoomSummaryDto = {
  readonly roomId: string;
  readonly playerCount: 0 | 1 | 2;
  readonly status: 'in_progress' | 'finished';
  readonly ruleset: WireRuleset;
};

export type CreateRoomResponseDto = {
  readonly roomId: string;
};

/** The seat a creator asks for. `random` is resolved during creation. */
export const SeatChoiceSchema = z.enum(['white', 'black', 'random']);
export type SeatChoice = z.infer<typeof SeatChoiceSchema>;

/** The server parses it with `CreateRoomBodySchema`. */
export type CreateRoomRequestDto = {
  readonly seat: SeatChoice;
  /** Absent means base, the same absence `WireGameState.ruleset` uses. */
  readonly ruleset?: WireRuleset;
};

// A room the caller holds a seat in. Every row is in progress and seated by
// construction, so there is no `status` and `seat` is never null.
export type MyRoomSummaryDto = {
  readonly roomId: string;
  readonly seat: 'white' | 'black';
  readonly playerCount: 1 | 2;
  /** Epoch milliseconds, rendered as a relative time. */
  readonly updatedAt: number;
  readonly ruleset: WireRuleset;
};

// An offer to play that nobody has taken yet. No seeker name: the board shows
// terms and age, so a listing joins nothing.
export type SeekDto = {
  readonly seekId: string;
  readonly preference: SeekPreference;
  /** Epoch milliseconds, rendered as an age. */
  readonly createdAt: number;
};

// Split rather than flagged, because the lobby gives your own seek a cancel
// action and everyone else's a click that pairs.
export type SeekBoardDto = {
  readonly mine: readonly SeekDto[];
  readonly pool: readonly SeekDto[];
};

/** The server parses it with `PostSeekBodySchema`. */
export type PostSeekRequestDto = {
  /** Absent is the default seek, which pairs with anything. */
  readonly preference?: SeekPreference;
  /** Set to take one listed seek instead of matching against the pool. */
  readonly seekId?: string;
};

// Posting a seek either gets you a game or puts you on the board. The client
// has one call and two answers, not a create followed by a poll.
export type PostSeekResponseDto =
  | { readonly outcome: 'paired'; readonly roomId: string }
  | { readonly outcome: 'waiting'; readonly seek: SeekDto };

// A keyset page. `nextCursor` is the cursor for the page after this one, and
// is absent on the last page; it is opaque, and only ever handed back as-is.
export type Page<T> = {
  readonly items: readonly T[];
  readonly nextCursor?: string;
};

// A seat as the game remembers it. `name` is snapshotted at archive time, so
// it outlives the account: a deleted player keeps a name with no `userId`, and
// a seat nobody ever took is null on both.
export type ArchivedPlayerDto = {
  readonly userId: string | null;
  readonly name: string | null;
};

export type ArchivedSeatPlayersDto = {
  readonly white: ArchivedPlayerDto;
  readonly black: ArchivedPlayerDto;
};

// A row is served from one player's side: `seat` is the seat that player held
// in the game, never null, exactly as `MyRoomSummaryDto.seat` is not. On a
// profile listing that player is the profile owner, not the caller.
export type ArchivedGameSummaryDto = {
  readonly gameId: string;
  readonly seat: 'white' | 'black';
  readonly players: ArchivedSeatPlayersDto;
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

/** The only editable field on a profile. The server parses it with `ProfileNameSchema`. */
export type UpdateProfileRequestDto = {
  readonly name: string;
};

/**
 * The social providers this deployment has credentials for. `/signin` renders
 * a button per entry, so an unconfigured provider is simply absent rather than
 * a button that fails on click.
 */
export type AuthProviderId = 'google' | 'github';

export type AuthProvidersDto = {
  readonly providers: readonly AuthProviderId[];
};
