import { describe, expect, it } from 'vitest';
import type { Identity } from '../domain/identity.js';
import { createRoom, seatPlayer, touch } from '../domain/room.js';
import { createTestStores } from '../testing/stores.js';
import {
  ABANDONED_ROOM_TTL_MS,
  type SweepPorts,
  sweepAbandonedRooms,
} from './sweep-abandoned-rooms.js';

const ident = (id: string): Identity => ({ playerId: id });
const at = (ms: number) => new Date(ms);
const PAST_CUTOFF = at(ABANDONED_ROOM_TTL_MS + 1);
// Far enough on that a room last written at 5000 is past the cutoff too.
const WELL_PAST_CUTOFF = at(ABANDONED_ROOM_TTL_MS + 5001);

const FINISHED = { status: 'finished', result: 'draw', endReason: 'queen-surrounded' } as const;

const setup = (): SweepPorts =>
  createTestStores([
    { id: 'alice', name: 'Alice' },
    { id: 'bob', name: 'Bob' },
  ]);

const finishedGame = (id: string, writtenAt: Date) => {
  const room = seatPlayer(createRoom(id, ident('alice'), at(0)), ident('bob'));
  return touch({ ...room, state: { ...room.state, ...FINISHED } }, writtenAt);
};

describe('sweepAbandonedRooms', () => {
  it('keeps a room that reached the cutoff exactly', async () => {
    const ports = setup();
    await ports.rooms.create(createRoom('r1', ident('alice'), at(0)));

    expect(await sweepAbandonedRooms(ports, at(ABANDONED_ROOM_TTL_MS))).toBe(0);
    expect(await ports.rooms.get('r1')).toBeDefined();
  });

  it('removes a room with a free seat once it is past the cutoff', async () => {
    const ports = setup();
    await ports.rooms.create(createRoom('r1', ident('alice'), at(0)));

    expect(await sweepAbandonedRooms(ports, PAST_CUTOFF)).toBe(1);
    expect(await ports.rooms.get('r1')).toBeUndefined();
  });

  it('leaves a full game in progress alone however old', async () => {
    const ports = setup();
    await ports.rooms.create(seatPlayer(createRoom('r1', ident('alice'), at(0)), ident('bob')));

    expect(await sweepAbandonedRooms(ports, at(ABANDONED_ROOM_TTL_MS * 365))).toBe(0);
    expect(await ports.rooms.get('r1')).toBeDefined();
  });

  it('counts every room it removes', async () => {
    const ports = setup();
    await ports.rooms.create(createRoom('r1', ident('alice'), at(0)));
    await ports.rooms.create(createRoom('r2', ident('bob'), at(0)));
    await ports.rooms.create(finishedGame('r3', at(0)));

    expect(await sweepAbandonedRooms(ports, PAST_CUTOFF)).toBe(3);
  });

  it('archives a finished game before deleting it', async () => {
    const ports = setup();
    await ports.rooms.create(finishedGame('r1', at(5000)));

    expect(await sweepAbandonedRooms(ports, WELL_PAST_CUTOFF)).toBe(1);
    expect(await ports.rooms.get('r1')).toBeUndefined();
    expect(await ports.archive.get('r1')).toMatchObject({
      id: 'r1',
      result: 'draw',
      endReason: 'queen-surrounded',
      startedAt: at(0),
      finishedAt: at(5000),
      players: {
        white: { playerId: 'alice', name: 'Alice' },
        black: { playerId: 'bob', name: 'Bob' },
      },
    });
  });

  it('keeps a game it failed to archive', async () => {
    const ports = setup();
    const archive = {
      ...ports.archive,
      record: async () => {
        throw new Error('archive is down');
      },
    };
    await ports.rooms.create(finishedGame('r1', at(5000)));

    expect(await sweepAbandonedRooms({ ...ports, archive }, WELL_PAST_CUTOFF)).toBe(0);
    expect(await ports.rooms.get('r1')).toBeDefined();
  });

  it('re-archiving a game the live path already wrote leaves the first row alone', async () => {
    const ports = setup();
    const first = finishedGame('r1', at(5000));
    await ports.rooms.create(first);
    await ports.archive.record({
      id: 'r1',
      players: { white: { playerId: 'alice', name: 'Alice' }, black: undefined },
      result: 'draw',
      endReason: 'queen-surrounded',
      startedAt: at(0),
      finishedAt: at(4000),
      moveCount: 0,
      state: first.state as never,
    });

    expect(await sweepAbandonedRooms(ports, WELL_PAST_CUTOFF)).toBe(1);
    expect((await ports.archive.get('r1'))?.finishedAt).toEqual(at(4000));
  });
});
