import { describe, expect, it } from 'vitest';
import { type PlayerGameOutcome, computeRecord } from './player-record.js';

const outcome = (over: Partial<PlayerGameOutcome> = {}): PlayerGameOutcome => ({
  seat: 'white',
  result: 'white-wins',
  endReason: 'queen-surrounded',
  moveCount: 10,
  finishedAt: new Date(1000),
  ...over,
});

const win = (over: Partial<PlayerGameOutcome> = {}) => outcome(over);
const loss = (over: Partial<PlayerGameOutcome> = {}) => outcome({ result: 'black-wins', ...over });
const draw = (over: Partial<PlayerGameOutcome> = {}) => outcome({ result: 'draw', ...over });

describe('computeRecord', () => {
  it('counts nothing as zeroes rather than dividing by zero', () => {
    expect(computeRecord([])).toEqual({
      overall: { played: 0, wins: 0, losses: 0, draws: 0, winRate: 0 },
      asWhite: { played: 0, wins: 0, losses: 0, draws: 0, winRate: 0 },
      asBlack: { played: 0, wins: 0, losses: 0, draws: 0, winRate: 0 },
      averageMoves: 0,
      endings: { queenSurrounded: 0, resignation: 0 },
      longestWinStreak: 0,
      lastPlayedAt: null,
    });
  });

  it('reads a win from the seat the player held', () => {
    const record = computeRecord([
      win({ seat: 'white', result: 'white-wins' }),
      win({ seat: 'black', result: 'black-wins' }),
      loss({ seat: 'black', result: 'white-wins' }),
    ]);

    expect(record.overall).toEqual({ played: 3, wins: 2, losses: 1, draws: 0, winRate: 0.667 });
    expect(record.asWhite).toMatchObject({ played: 1, wins: 1 });
    expect(record.asBlack).toMatchObject({ played: 2, wins: 1, losses: 1 });
  });

  it('counts a draw for the player on either seat', () => {
    expect(computeRecord([draw({ seat: 'white' })]).overall).toMatchObject({ draws: 1, wins: 0 });
    expect(computeRecord([draw({ seat: 'black' })]).overall).toMatchObject({ draws: 1, wins: 0 });
  });

  it('averages the plies of every game', () => {
    expect(computeRecord([outcome({ moveCount: 3 }), outcome({ moveCount: 4 })]).averageMoves).toBe(
      3.5,
    );
  });

  it('splits how the games ended', () => {
    expect(computeRecord([outcome(), outcome({ endReason: 'resignation' })]).endings).toEqual({
      queenSurrounded: 1,
      resignation: 1,
    });
  });

  it('takes the longest run of wins by finish order, whatever order it is given', () => {
    const outcomes = [
      win({ finishedAt: new Date(1) }),
      win({ finishedAt: new Date(2) }),
      loss({ finishedAt: new Date(3) }),
      win({ finishedAt: new Date(4) }),
      win({ finishedAt: new Date(5) }),
      win({ finishedAt: new Date(6) }),
    ];

    expect(computeRecord(outcomes).longestWinStreak).toBe(3);
    expect(computeRecord([...outcomes].reverse()).longestWinStreak).toBe(3);
  });

  it('breaks a streak on a draw', () => {
    expect(
      computeRecord([
        win({ finishedAt: new Date(1) }),
        draw({ finishedAt: new Date(2) }),
        win({ finishedAt: new Date(3) }),
      ]).longestWinStreak,
    ).toBe(1);
  });

  it('takes last played from the newest finish, not the last element', () => {
    expect(
      computeRecord([
        outcome({ finishedAt: new Date(9000) }),
        outcome({ finishedAt: new Date(3000) }),
      ]).lastPlayedAt,
    ).toEqual(new Date(9000));
  });
});
