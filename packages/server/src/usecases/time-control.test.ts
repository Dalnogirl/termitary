import type { TimeControl } from '@termitary/clock';
import { BASE_RULESET, listValidMoves } from '@termitary/engine';
import { type ServerMessage, toWireMove } from '@termitary/protocol';
import { describe, expect, it } from 'vitest';
import { createInMemoryConnectionRegistry } from '../adapters/in-memory-connection-registry.js';
import type { Sender } from '../domain/connection-registry.js';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import type { RoomStore } from '../domain/room-store.js';
import { createPairedRoom, play } from '../domain/room.js';
import { createTestStores } from '../testing/stores.js';
import { claimTimeout } from './claim-timeout.js';
import { joinGame } from './join-game.js';
import { makeMove } from './make-move.js';
import { resign } from './resign.js';

const ident = (id: string): Identity => ({ playerId: id });
const BLITZ: TimeControl = { kind: 'realtime', initialMs: 300_000, incrementMs: 3_000 };
const at = (ms: number) => ({ clock: () => new Date(ms) });

// Both first moves land at 1s and 2s, so white's bank runs from 2s and white
// flags at 302s.
const WHITE_FLAGS_AT = 302_000;

type Inbox = { messages: ServerMessage[] };

const setup = () => {
  const connections = createInMemoryConnectionRegistry();
  const { close: _close, ...stores } = createTestStores(['alice', 'bob', 'carol']);
  const ports: Ports = { ...stores, connections };
  const connect = (playerId: string): Inbox => {
    const inbox: Inbox = { messages: [] };
    const sender: Sender = async (msg) => {
      inbox.messages.push(msg);
    };
    connections.bind(playerId, sender);
    return inbox;
  };
  return { ports, connect };
};

const lastOf = (inbox: Inbox): ServerMessage => {
  const m = inbox.messages.at(-1);
  if (!m) throw new Error('inbox empty');
  return m;
};

const firstLegalMove = async (rooms: RoomStore, roomId: string) => {
  const room = await rooms.get(roomId);
  if (room === undefined || room.state.status === 'finished') throw new Error('no game');
  const move = listValidMoves(room.state)[0];
  if (move === undefined) throw new Error('no legal move');
  return toWireMove(move);
};

const moveNow = async (ports: Ports, player: string, roomId: string, ms: number) =>
  makeMove(
    ident(player),
    { type: 'makeMove', roomId, move: await firstLegalMove(ports.rooms, roomId) },
    ports,
    at(ms),
  );

// Alice is white. Both players attached, both first moves made.
const runningGame = async () => {
  const { ports, connect } = setup();
  const alice = connect('alice');
  const bob = connect('bob');
  const room = createPairedRoom(
    'r1',
    ident('alice'),
    ident('bob'),
    new Date(0),
    BASE_RULESET,
    BLITZ,
  );
  await ports.rooms.create(room);
  await joinGame(ident('alice'), { type: 'joinGame', roomId: room.id }, ports, at(0));
  await joinGame(ident('bob'), { type: 'joinGame', roomId: room.id }, ports, at(0));
  await moveNow(ports, 'alice', room.id, 1000);
  await moveNow(ports, 'bob', room.id, 2000);
  return { ports, connect, alice, bob, roomId: room.id };
};

const expectTimedOut = (msg: ServerMessage, loser: 'white' | 'black') => {
  if (msg.type !== 'stateUpdated') throw new Error(`expected stateUpdated, got ${msg.type}`);
  expect(msg.state).toMatchObject({
    status: 'finished',
    endReason: 'timeout',
    result: loser === 'white' ? 'black-wins' : 'white-wins',
  });
};

describe('a move against the clock', () => {
  it('lands just inside the deadline, charged and incremented', async () => {
    const { ports, bob, roomId } = await runningGame();

    await moveNow(ports, 'alice', roomId, WHITE_FLAGS_AT - 1);

    const msg = lastOf(bob);
    if (msg.type !== 'stateUpdated') throw new Error(`expected stateUpdated, got ${msg.type}`);
    expect(msg.state.status).toBe('in_progress');
    expect(msg.clock).toEqual({
      timeControl: BLITZ,
      remainingMs: { white: 3_001, black: 300_000 },
    });
  });

  it('just past the deadline finishes the game on time instead of being played', async () => {
    const { ports, alice, bob, roomId } = await runningGame();

    await moveNow(ports, 'alice', roomId, WHITE_FLAGS_AT);

    expectTimedOut(lastOf(alice), 'white');
    expectTimedOut(lastOf(bob), 'white');
    const archived = await ports.archive.get(roomId);
    expect(archived?.endReason).toBe('timeout');
    expect(archived?.moveCount).toBe(2);
    expect(archived?.finishedAt).toEqual(new Date(WHITE_FLAGS_AT));
    expect(await ports.rooms.get(roomId)).toBeUndefined();
  });

  it('from the waiting side finishes a flagged game rather than being refused as out of turn', async () => {
    const { ports, alice, roomId } = await runningGame();

    await moveNow(ports, 'bob', roomId, WHITE_FLAGS_AT);

    expectTimedOut(lastOf(alice), 'white');
  });

  it('from a stranger finishes nothing', async () => {
    const { ports, connect, roomId } = await runningGame();
    const carol = connect('carol');

    await moveNow(ports, 'carol', roomId, WHITE_FLAGS_AT);

    expect(lastOf(carol)).toMatchObject({ type: 'error', message: 'not in room' });
    expect(await ports.rooms.get(roomId)).toBeDefined();
  });
});

describe('a first move against the clock', () => {
  it('missed by white finishes the game on time', async () => {
    const { ports, connect } = setup();
    const bob = connect('bob');
    const room = createPairedRoom(
      'r1',
      ident('alice'),
      ident('bob'),
      new Date(0),
      BASE_RULESET,
      BLITZ,
    );
    await ports.rooms.create(room);
    await joinGame(ident('bob'), { type: 'joinGame', roomId: room.id }, ports, at(0));

    await moveNow(ports, 'alice', room.id, 30_000);

    expectTimedOut(lastOf(bob), 'white');
  });
});

describe('a flag the archive cannot take', () => {
  it('leaves the room as it was and tells whoever noticed', async () => {
    const { ports, alice, roomId } = await runningGame();
    const before = await ports.rooms.getForUpdate(roomId);
    const broken: Ports = {
      ...ports,
      unitOfWork: {
        commit: async () => {
          throw new Error('archive is down');
        },
      },
    };

    await moveNow(broken, 'alice', roomId, WHITE_FLAGS_AT);

    expect(lastOf(alice)).toMatchObject({ type: 'error', message: 'could not finish the game' });
    expect(await ports.rooms.getForUpdate(roomId)).toEqual(before);
  });
});

describe('a resignation against the clock', () => {
  it('after the flag is a timeout, not a resignation', async () => {
    const { ports, bob, roomId } = await runningGame();

    await resign(ident('alice'), { type: 'resign', roomId }, ports, at(WHITE_FLAGS_AT));

    expectTimedOut(lastOf(bob), 'white');
  });
});

describe('a timeout claim', () => {
  const claim = (ports: Ports, player: string, roomId: string, ms: number) =>
    claimTimeout(ident(player), { type: 'claimTimeout', roomId }, ports, at(ms));

  it('that holds finishes the game on time for both players', async () => {
    const { ports, alice, bob, roomId } = await runningGame();

    await claim(ports, 'bob', roomId, WHITE_FLAGS_AT);

    expectTimedOut(lastOf(alice), 'white');
    expectTimedOut(lastOf(bob), 'white');
    expect((await ports.archive.get(roomId))?.finishedAt).toEqual(new Date(WHITE_FLAGS_AT));
  });

  it('made early answers the claimant with the clock as the server reads it', async () => {
    const { ports, alice, bob, roomId } = await runningGame();
    const aliceHeard = alice.messages.length;

    await claim(ports, 'bob', roomId, WHITE_FLAGS_AT - 1);

    expect(lastOf(bob)).toMatchObject({
      type: 'stateUpdated',
      state: { status: 'in_progress' },
      clock: { remainingMs: { white: 1, black: 300_000 } },
    });
    expect(alice.messages).toHaveLength(aliceHeard);
    expect(await ports.rooms.get(roomId)).toBeDefined();
  });

  it('on a game already archived sends the claimant there', async () => {
    const { ports, bob, roomId } = await runningGame();
    await claim(ports, 'bob', roomId, WHITE_FLAGS_AT);

    await claim(ports, 'bob', roomId, WHITE_FLAGS_AT + 1);

    expect(lastOf(bob)).toEqual({ type: 'gameArchived', roomId });
  });

  it('from a stranger finishes nothing', async () => {
    const { ports, connect, roomId } = await runningGame();
    const carol = connect('carol');

    await claim(ports, 'carol', roomId, WHITE_FLAGS_AT);

    expect(lastOf(carol)).toMatchObject({ type: 'error', message: 'not in room' });
    expect(await ports.rooms.get(roomId)).toBeDefined();
  });
});

describe('joining against the clock', () => {
  it('reads both clocks as of the join', async () => {
    const { ports, alice, roomId } = await runningGame();

    await joinGame(ident('alice'), { type: 'joinGame', roomId }, ports, at(12_000));

    expect(lastOf(alice)).toMatchObject({
      type: 'gameJoined',
      clock: { timeControl: BLITZ, remainingMs: { white: 290_000, black: 300_000 } },
    });
  });

  it('after the flag finishes the game and sends the joiner to the archive', async () => {
    const { ports, connect, roomId } = await runningGame();
    // Alice comes back on a fresh socket, not yet attached to the room.
    const alice = connect('alice');
    await ports.connections.leaveRoom('alice');

    await joinGame(ident('alice'), { type: 'joinGame', roomId }, ports, at(WHITE_FLAGS_AT));

    expect(lastOf(alice)).toEqual({ type: 'gameArchived', roomId });
    expect((await ports.archive.get(roomId))?.endReason).toBe('timeout');
  });
});

describe('a move racing a flag', () => {
  it('loses to a flag committed first, and is sent to the archive on re-run', async () => {
    const { ports, alice, roomId } = await runningGame();
    let raced = false;
    const racing: Ports = {
      ...ports,
      rooms: {
        ...ports.rooms,
        save: async (room, expected) => {
          if (!raced) {
            raced = true;
            await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports, at(WHITE_FLAGS_AT));
          }
          await ports.rooms.save(room, expected);
        },
      },
    };

    await makeMove(
      ident('alice'),
      { type: 'makeMove', roomId, move: await firstLegalMove(ports.rooms, roomId) },
      racing,
      at(WHITE_FLAGS_AT - 1),
    );

    expect(lastOf(alice)).toEqual({ type: 'gameArchived', roomId });
    expect((await ports.archive.get(roomId))?.endReason).toBe('timeout');
  });

  it('beats a flag check that read before it, which then finds time on the clock', async () => {
    const { ports, bob, roomId } = await runningGame();
    let raced = false;
    // Bob's join reads the room flagged, but Alice's in-time move commits
    // between that read and the finish.
    const racing: Ports = {
      ...ports,
      unitOfWork: {
        commit: async (ops) => {
          if (!raced) {
            raced = true;
            const current = await ports.rooms.getForUpdate(roomId);
            if (current === undefined || current.value.state.status === 'finished') {
              throw new Error('no game');
            }
            const move = listValidMoves(current.value.state)[0];
            if (move === undefined) throw new Error('no legal move');
            const played = play(current.value, 'white', move, new Date(WHITE_FLAGS_AT - 1));
            await ports.rooms.save(played, current.version);
          }
          await ports.unitOfWork.commit(ops);
        },
      },
    };

    await joinGame(ident('bob'), { type: 'joinGame', roomId }, racing, at(WHITE_FLAGS_AT));

    expect(lastOf(bob)).toMatchObject({ type: 'gameJoined', state: { status: 'in_progress' } });
    expect(await ports.archive.get(roomId)).toBeUndefined();
  });
});
