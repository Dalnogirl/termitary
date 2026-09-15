import type { ArchivedGameSummaryDto } from '@termitary/protocol';
import { describe, expect, it } from 'vitest';
import {
  archivedDetail,
  endReasonLabel,
  opponentName,
  opponentOf,
  outcomeLabel,
} from './summary.js';

const game = (over: Partial<ArchivedGameSummaryDto> = {}): ArchivedGameSummaryDto => ({
  gameId: 'g1',
  seat: 'white',
  players: {
    white: { userId: 'u-me', name: 'me' },
    black: { userId: 'u-them', name: 'them' },
  },
  result: 'white-wins',
  endReason: 'queen-surrounded',
  startedAt: 0,
  finishedAt: 0,
  moveCount: 12,
  ...over,
});

describe('opponentName', () => {
  it('names the other seat, not the caller', () => {
    expect(opponentName(game({ seat: 'white' }))).toBe('them');
    expect(opponentName(game({ seat: 'black' }))).toBe('me');
  });

  it('falls back when nobody held the seat', () => {
    const players = {
      white: { userId: 'u-me', name: 'me' },
      black: { userId: null, name: null },
    };
    expect(opponentName(game({ players }))).toBe('Unknown opponent');
  });
});

describe('opponentOf', () => {
  it('keeps the opponent’s id, so a row can link to their profile', () => {
    expect(opponentOf(game({ seat: 'white' }))).toEqual({ userId: 'u-them', name: 'them' });
  });
});

describe('outcomeLabel', () => {
  it('reads the result from the row’s seat, in the third person', () => {
    expect(outcomeLabel(game({ seat: 'white', result: 'white-wins' }))).toBe('Won');
    expect(outcomeLabel(game({ seat: 'black', result: 'white-wins' }))).toBe('Lost');
  });

  it('has no side for a draw', () => {
    expect(outcomeLabel(game({ result: 'draw' }))).toBe('Draw');
  });
});

describe('endReasonLabel', () => {
  it('names who resigned', () => {
    const resigned = { endReason: 'resignation' } as const;
    expect(endReasonLabel(game({ ...resigned, seat: 'white', result: 'white-wins' }))).toBe(
      'opponent resigned',
    );
    expect(endReasonLabel(game({ ...resigned, seat: 'black', result: 'white-wins' }))).toBe(
      'resigned',
    );
  });

  it('pluralizes the queens on a draw', () => {
    expect(endReasonLabel(game({ result: 'draw' }))).toBe('both queens surrounded');
  });
});

describe('archivedDetail', () => {
  it('carries outcome, seat and move count', () => {
    expect(archivedDetail(game({ finishedAt: Date.now() }))).toBe(
      'Won, queen surrounded · playing white · 12 moves · just now',
    );
  });
});
