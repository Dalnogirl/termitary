import type { TimeControl } from '@termitary/clock';
import { BASE_RULESET } from '@termitary/engine';
import { BEFORE_SQUEEZE, SQUEEZE } from '@termitary/engine/testing';
import { describe, expect, it } from 'vitest';
import { type Room, createPairedRoom, finishedOnTime, play } from './room.js';

const BLITZ: TimeControl = { kind: 'realtime', initialMs: 300_000, incrementMs: 3_000 };
const at = (ms: number) => new Date(ms);

const timedRoom = () =>
  createPairedRoom('r1', { playerId: 'w' }, { playerId: 'b' }, at(0), BASE_RULESET, BLITZ);

const scripted = (i: number) => {
  const move = BEFORE_SQUEEZE[i];
  if (move === undefined) throw new Error(`no scripted move ${i}`);
  return move;
};

const turnOf = (room: Room) => {
  if (room.state.status === 'finished') throw new Error('game is over');
  return room.state.currentPlayer;
};

describe('play', () => {
  it('charges the mover and hands the clock to the other side', () => {
    const room = play(timedRoom(), 'white', scripted(0), at(1000));
    expect(room.clock.toMove).toBe('black');
    expect(room.clock.log).toEqual([{ side: 'white', remainingMs: 300_000 }]);
    expect(room.updatedAt).toEqual(at(1000));
  });

  it('charges a forced pass too, so the clock agrees with the game', () => {
    const before = BEFORE_SQUEEZE.reduce(
      (room, move, i) => play(room, turnOf(room), move, at((i + 1) * 1000)),
      timedRoom(),
    );
    const squeezed = play(before, 'black', SQUEEZE, at(20_000));

    expect(squeezed.state.history.at(-1)).toEqual({ kind: 'pass' });
    expect(turnOf(squeezed)).toBe('black');
    expect(squeezed.clock.toMove).toBe('black');
    expect(squeezed.clock.log.at(-1)?.side).toBe('white');
  });
});

describe('finishedOnTime', () => {
  // Both first moves made at 1s and 2s, so white's bank runs from 2s.
  const running = () => {
    const first = play(timedRoom(), 'white', scripted(0), at(1000));
    return play(first, 'black', scripted(1), at(2000));
  };

  it('leaves a room alone while the side to move has time', () => {
    expect(finishedOnTime(running(), at(301_999))).toBeUndefined();
  });

  it('finishes the room as a loss on time for the side to move', () => {
    const finished = finishedOnTime(running(), at(302_000));
    expect(finished?.state).toMatchObject({
      status: 'finished',
      result: 'black-wins',
      endReason: 'timeout',
    });
    expect(finished?.updatedAt).toEqual(at(302_000));
  });

  it('stamps the finish at the deadline, however late it was noticed', () => {
    expect(finishedOnTime(running(), at(10_000_000))?.updatedAt).toEqual(at(302_000));
  });

  it('counts a missed first move as a timeout', () => {
    const finished = finishedOnTime(timedRoom(), at(90_000));
    expect(finished?.state).toMatchObject({ endReason: 'timeout', result: 'black-wins' });
    expect(finished?.updatedAt).toEqual(at(30_000));
  });

  it('never finishes an untimed room', () => {
    const room = createPairedRoom('r1', { playerId: 'w' }, { playerId: 'b' }, at(0));
    expect(finishedOnTime(room, at(10 ** 12))).toBeUndefined();
  });
});
