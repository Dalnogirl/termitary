import { BASE_RULESET, IllegalRulesetError } from '@termitary/engine';
import { describe, expect, it } from 'vitest';
import { createTestStores } from '../testing/stores.js';
import { createRoom } from './create-room.js';

const always = (seat: 'white' | 'black') => () => seat;

describe('createRoom use case', () => {
  it('creates a room, seats the caller in the seat they asked for, returns the id', async () => {
    const { rooms } = createTestStores(['alice']);
    const { roomId } = await createRoom(
      { playerId: 'alice' },
      { seat: 'white' },
      rooms,
      always('black'),
    );

    const stored = await rooms.get(roomId);
    expect(stored).toBeDefined();
    expect(stored?.players.white?.playerId).toBe('alice');
    expect(stored?.players.black).toBeUndefined();
    expect(stored?.state.status).toBe('in_progress');
  });

  it('seats the caller black and leaves white free', async () => {
    const { rooms } = createTestStores(['alice']);
    const { roomId } = await createRoom(
      { playerId: 'alice' },
      { seat: 'black' },
      rooms,
      always('white'),
    );

    const stored = await rooms.get(roomId);
    expect(stored?.players.black?.playerId).toBe('alice');
    expect(stored?.players.white).toBeUndefined();
  });

  it('resolves `random` through the picker, not Math.random', async () => {
    const { rooms } = createTestStores(['alice']);
    const { roomId } = await createRoom(
      { playerId: 'alice' },
      { seat: 'random' },
      rooms,
      always('black'),
    );

    const stored = await rooms.get(roomId);
    expect(stored?.players.black?.playerId).toBe('alice');
    expect(stored?.players.white).toBeUndefined();
  });

  it('calls the picker only for `random`', async () => {
    const { rooms } = createTestStores(['alice']);
    let calls = 0;
    const counting = () => {
      calls += 1;
      return 'white' as const;
    };
    await createRoom({ playerId: 'alice' }, { seat: 'white' }, rooms, counting);
    expect(calls).toBe(0);
    await createRoom({ playerId: 'alice' }, { seat: 'random' }, rooms, counting);
    expect(calls).toBe(1);
  });

  it('stores the ruleset the creator asked for, in the room and in the hands', async () => {
    const { rooms } = createTestStores(['alice']);
    const { roomId } = await createRoom(
      { playerId: 'alice' },
      { seat: 'white', ruleset: { pieces: { ...BASE_RULESET.pieces, ladybug: 1 } } },
      rooms,
      always('white'),
    );

    const stored = await rooms.get(roomId);
    expect(stored?.ruleset.pieces.ladybug).toBe(1);
    expect(stored?.state.hands.white.ladybug).toBe(1);
    expect(stored?.state.hands.black.ladybug).toBe(1);
  });

  it('creates a base game when the body names no ruleset', async () => {
    const { rooms } = createTestStores(['alice']);
    const { roomId } = await createRoom(
      { playerId: 'alice' },
      { seat: 'white' },
      rooms,
      always('white'),
    );

    expect((await rooms.get(roomId))?.ruleset).toEqual(BASE_RULESET);
  });

  it('refuses a ruleset the engine calls illegal rather than storing it', async () => {
    const { rooms } = createTestStores(['alice']);
    await expect(
      createRoom(
        { playerId: 'alice' },
        { seat: 'white', ruleset: { pieces: { ant: 3 } } },
        rooms,
        always('white'),
      ),
    ).rejects.toThrow(IllegalRulesetError);
  });

  it('returns a distinct roomId on each invocation', async () => {
    const { rooms } = createTestStores(['alice']);
    const a = await createRoom({ playerId: 'alice' }, { seat: 'white' }, rooms, always('white'));
    const b = await createRoom({ playerId: 'alice' }, { seat: 'white' }, rooms, always('white'));
    expect(a.roomId).not.toBe(b.roomId);
  });

  it('does not touch the connection registry (no WS context)', async () => {
    // Implicit assertion: createRoom takes only `rooms`, not `Ports`. If a
    // future change re-introduces a connections dependency, this test will
    // fail to compile.
    const { rooms } = createTestStores(['alice']);
    await createRoom({ playerId: 'alice' }, { seat: 'white' }, rooms, always('white'));
  });
});
