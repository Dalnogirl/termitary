import type { Color, EndReason } from '@termitary/engine';
import type { ArchivedGameOverview } from './archived-game.js';

/** One finished game as a record counts it: the player's own seat, and the outcome. */
export type PlayerGameOutcome = {
  readonly seat: Color;
  readonly result: ArchivedGameOverview['result'];
  readonly endReason: EndReason;
  readonly moveCount: number;
  readonly finishedAt: Date;
};

export type SeatRecord = {
  readonly played: number;
  readonly wins: number;
  readonly losses: number;
  readonly draws: number;
  readonly winRate: number;
};

export type PlayerRecord = {
  readonly overall: SeatRecord;
  readonly asWhite: SeatRecord;
  readonly asBlack: SeatRecord;
  readonly averageMoves: number;
  readonly endings: {
    readonly queenSurrounded: number;
    readonly resignation: number;
  };
  readonly longestWinStreak: number;
  readonly lastPlayedAt: Date | null;
};

const won = (outcome: PlayerGameOutcome): boolean =>
  outcome.result === (outcome.seat === 'white' ? 'white-wins' : 'black-wins');

const ratio = (part: number, whole: number): number =>
  whole === 0 ? 0 : Math.round((part / whole) * 1000) / 1000;

const seatRecord = (outcomes: readonly PlayerGameOutcome[]): SeatRecord => {
  const wins = outcomes.filter(won).length;
  const draws = outcomes.filter((outcome) => outcome.result === 'draw').length;
  return {
    played: outcomes.length,
    wins,
    losses: outcomes.length - wins - draws,
    draws,
    winRate: ratio(wins, outcomes.length),
  };
};

const longestWinStreak = (byFinish: readonly PlayerGameOutcome[]): number =>
  byFinish.reduce(
    ({ best, run }, outcome) => {
      const next = won(outcome) ? run + 1 : 0;
      return { best: Math.max(best, next), run: next };
    },
    { best: 0, run: 0 },
  ).best;

/** Order-independent: the streak reads the copy this sorts, not the caller's order. */
export const computeRecord = (outcomes: readonly PlayerGameOutcome[]): PlayerRecord => {
  const byFinish = [...outcomes].sort((a, b) => a.finishedAt.getTime() - b.finishedAt.getTime());
  const moves = outcomes.reduce((total, outcome) => total + outcome.moveCount, 0);
  return {
    overall: seatRecord(outcomes),
    asWhite: seatRecord(outcomes.filter((outcome) => outcome.seat === 'white')),
    asBlack: seatRecord(outcomes.filter((outcome) => outcome.seat === 'black')),
    averageMoves: ratio(moves, outcomes.length),
    endings: {
      queenSurrounded: outcomes.filter((outcome) => outcome.endReason === 'queen-surrounded')
        .length,
      resignation: outcomes.filter((outcome) => outcome.endReason === 'resignation').length,
    },
    longestWinStreak: longestWinStreak(byFinish),
    lastPlayedAt: byFinish.at(-1)?.finishedAt ?? null,
  };
};
