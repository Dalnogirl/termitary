import type { Board, GameState, Piece } from '@termitary/engine';
import { listValidMoves } from '@termitary/engine';
import type { ServerMessage } from '@termitary/protocol';
import { fromWire, toWireMove } from '@termitary/protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryConnectionRegistry } from '../adapters/in-memory-connection-registry.js';
import type { Sender } from '../domain/connection-registry.js';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { touch } from '../domain/room.js';
import { createTestStores } from '../testing/stores.js';
import { archiveFinished } from './archive-finished.js';
import { cancelRoom } from './cancel-room.js';
import { createRoom } from './create-room.js';
import { joinGame } from './join-game.js';
import { makeMove } from './make-move.js';
import { resign } from './resign.js';

const ident = (id: string): Identity => ({ playerId: id });
const PLAYERS = [
  { id: 'alice', name: 'Alice' },
  { id: 'bob', name: 'Bob' },
  { id: 'carol', name: 'Carol' },
  { id: 'eve', name: 'Eve' },
];

type Inbox = { messages: ServerMessage[] };

const setup = () => {
  const connections = createInMemoryConnectionRegistry();
  const { rooms, archive, users, log } = createTestStores(PLAYERS);
  const ports: Ports = { rooms, connections, archive, users, log };
  const inboxes = new Map<string, Inbox>();
  const senders = new Map<string, Sender>();
  const connect = (playerId: string): Inbox => {
    const inbox: Inbox = { messages: [] };
    inboxes.set(playerId, inbox);
    const sender: Sender = async (msg) => {
      inbox.messages.push(msg);
    };
    senders.set(playerId, sender);
    connections.bind(playerId, sender);
    return inbox;
  };
  const disconnect = (playerId: string): void => {
    const sender = senders.get(playerId);
    if (sender !== undefined) connections.unbind(playerId, sender);
  };
  return { ports, connect, disconnect, inboxes };
};

const lastOf = (inbox: Inbox): ServerMessage => {
  const m = inbox.messages.at(-1);
  if (!m) throw new Error('inbox empty');
  return m;
};

// Provisions a room with `creator` seated as white. Mirrors production flow:
// REST POST /rooms (creates the room and seats the creator) followed by the
// creator's WS joinGame (re-attach branch, which adds them to the connection
// registry so subsequent broadcasts reach them).
const provisionRoom = async (ports: Ports, creator: string): Promise<string> => {
  const { roomId } = await createRoom(
    ident(creator),
    { seat: 'white' },
    ports.rooms,
    () => 'white',
  );
  await joinGame(ident(creator), { type: 'joinGame', roomId }, ports);
  return roomId;
};

describe('joinGame', () => {
  let ports: Ports;
  let alice: Inbox;
  let bob: Inbox;
  let connect: (id: string) => Inbox;
  let disconnect: (id: string) => void;
  let roomId: string;

  beforeEach(async () => {
    ({ ports, connect, disconnect } = setup());
    alice = connect('alice');
    bob = connect('bob');
    roomId = await provisionRoom(ports, 'alice');
  });

  it('seats the joiner as black and notifies both players', async () => {
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);

    const bobMsg = lastOf(bob);
    expect(bobMsg.type).toBe('gameJoined');
    if (bobMsg.type !== 'gameJoined') throw new Error('unreachable');
    expect(bobMsg.playerColor).toBe('black');
    expect(bobMsg.roomId).toBe(roomId);
    expect(bobMsg.opponent).toEqual({ status: 'connected', userId: 'alice', name: 'Alice' });

    const aliceKinds = alice.messages.map((m) => m.type);
    expect(aliceKinds).toContain('stateUpdated');
    expect(aliceKinds).toContain('presenceUpdate');
    const alicePresence = alice.messages.find((m) => m.type === 'presenceUpdate');
    if (alicePresence?.type !== 'presenceUpdate') throw new Error('unreachable');
    expect(alicePresence.opponent).toEqual({ status: 'connected', userId: 'bob', name: 'Bob' });

    const stored = await ports.rooms.get(roomId);
    expect(stored?.players.black?.playerId).toBe('bob');
  });

  it('still sends the seated opponent state when the name lookup fails', async () => {
    // The name rides on the presence channel, so losing it must not cost the
    // opponent the board they are about to play on. Only the joiner's own
    // name fails here; the lookup for the joiner's gameJoined still works.
    const failing: Ports = {
      ...ports,
      users: {
        ...ports.users,
        namesOf: async (ids) =>
          ids.includes('bob') ? Promise.reject(new Error('db down')) : ports.users.namesOf(ids),
      },
    };
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, failing);

    expect(alice.messages.map((m) => m.type)).toContain('stateUpdated');
  });

  it('reports opponent=empty in gameJoined when joining a one-seat room alone', async () => {
    // provisionRoom() already re-attached alice; here we just inspect the
    // message she received from that initial joinGame call.
    const aliceJoined = alice.messages.find((m) => m.type === 'gameJoined');
    if (aliceJoined?.type !== 'gameJoined') throw new Error('unreachable');
    expect(aliceJoined.opponent).toEqual({ status: 'empty' });
  });

  it('reports opponent=disconnected on re-attach when peer has no live socket', async () => {
    // Seat bob (real socket bound) then drop his binding to simulate a
    // dead socket while the seat remains claimed.
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);
    disconnect('bob');

    alice.messages.length = 0;
    await joinGame(ident('alice'), { type: 'joinGame', roomId }, ports);
    const msg = lastOf(alice);
    if (msg.type !== 'gameJoined') throw new Error('unreachable');
    expect(msg.opponent).toEqual({ status: 'disconnected', userId: 'bob', name: 'Bob' });
  });

  it('errors when the room does not exist', async () => {
    await joinGame(ident('bob'), { type: 'joinGame', roomId: 'nope' }, ports);
    const msg = lastOf(bob);
    expect(msg.type).toBe('error');
    if (msg.type !== 'error') throw new Error('unreachable');
    expect(msg.message).toBe('room not found');
  });

  it('errors when the room is full', async () => {
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);
    const carol = connect('carol');
    await joinGame(ident('carol'), { type: 'joinGame', roomId }, ports);
    const msg = lastOf(carol);
    expect(msg.type).toBe('error');
    if (msg.type !== 'error') throw new Error('unreachable');
    expect(msg.message).toBe('room is full');
  });

  it('re-attaches when the same player joins again, sending current state', async () => {
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);
    alice.messages.length = 0;

    await joinGame(ident('alice'), { type: 'joinGame', roomId }, ports);
    const msg = lastOf(alice);
    expect(msg.type).toBe('gameJoined');
    if (msg.type !== 'gameJoined') throw new Error('unreachable');
    expect(msg.playerColor).toBe('white');
    expect(msg.roomId).toBe(roomId);
  });

  it('notifies the opponent with presenceUpdate connected on re-attach', async () => {
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);
    bob.messages.length = 0;

    await joinGame(ident('alice'), { type: 'joinGame', roomId }, ports);
    // Re-attach does NOT mutate engine state, so bob must NOT see a
    // stateUpdated; only a presence transition.
    expect(bob.messages.map((m) => m.type)).toEqual(['presenceUpdate']);
    const msg = bob.messages[0];
    if (msg?.type !== 'presenceUpdate') throw new Error('unreachable');
    expect(msg.opponent).toEqual({ status: 'connected', userId: 'alice', name: 'Alice' });
  });
});

describe('makeMove', () => {
  it('applies a legal move and broadcasts new state to both players', async () => {
    const { ports, connect } = setup();
    const alice = connect('alice');
    const bob = connect('bob');
    const roomId = await provisionRoom(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);

    const room = await ports.rooms.get(roomId);
    if (!room) throw new Error('room missing');
    const firstMove = listValidMoves(room.state)[0];
    if (!firstMove) throw new Error('no valid moves');
    await makeMove(
      ident('alice'),
      { type: 'makeMove', roomId, move: toWireMove(firstMove) },
      ports,
    );

    const aliceMsg = lastOf(alice);
    const bobMsg = lastOf(bob);
    expect(aliceMsg.type).toBe('stateUpdated');
    expect(bobMsg.type).toBe('stateUpdated');
    if (aliceMsg.type !== 'stateUpdated') throw new Error('unreachable');
    expect(fromWire(aliceMsg.state).currentPlayer).toBe('black');
    expect(fromWire(aliceMsg.state).history.length).toBe(1);
  });

  it('rejects a move from the wrong player', async () => {
    const { ports, connect } = setup();
    connect('alice');
    const bob = connect('bob');
    const roomId = await provisionRoom(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);

    const room = await ports.rooms.get(roomId);
    if (!room) throw new Error('room missing');
    const aliceMove = listValidMoves(room.state)[0];
    if (!aliceMove) throw new Error('no valid moves');
    await makeMove(ident('bob'), { type: 'makeMove', roomId, move: toWireMove(aliceMove) }, ports);

    const bobMsg = lastOf(bob);
    expect(bobMsg.type).toBe('error');
    if (bobMsg.type !== 'error') throw new Error('unreachable');
    expect(bobMsg.message).toBe('not your turn');
  });

  it('rejects an illegal move with the engine error message', async () => {
    const { ports, connect } = setup();
    const alice = connect('alice');
    connect('bob');
    const roomId = await provisionRoom(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);

    await makeMove(
      ident('alice'),
      {
        type: 'makeMove',
        roomId,
        move: {
          kind: 'place',
          piece: { type: 'queen', color: 'white' },
          to: { q: 99, r: 99 },
        },
      },
      ports,
    );

    const msg = lastOf(alice);
    expect(msg.type).toBe('error');
  });

  it('rejects moves on unknown rooms and when the caller is not seated', async () => {
    const { ports, connect } = setup();
    const alice = connect('alice');
    const eve = connect('eve');
    const roomId = await provisionRoom(ports, 'alice');

    await makeMove(
      ident('alice'),
      { type: 'makeMove', roomId: 'nope', move: { kind: 'pass' } },
      ports,
    );
    expect(lastOf(alice).type).toBe('error');

    await makeMove(ident('eve'), { type: 'makeMove', roomId, move: { kind: 'pass' } }, ports);
    const eveMsg = lastOf(eve);
    expect(eveMsg.type).toBe('error');
    if (eveMsg.type !== 'error') throw new Error('unreachable');
    expect(eveMsg.message).toBe('not in room');
  });
});

describe('resign', () => {
  it('finishes the game for both players and keeps the room', async () => {
    const { ports, connect } = setup();
    const alice = connect('alice');
    const bob = connect('bob');
    const roomId = await provisionRoom(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);

    await resign(ident('alice'), { type: 'resign', roomId }, ports);

    for (const inbox of [alice, bob]) {
      const msg = lastOf(inbox);
      expect(msg.type).toBe('stateUpdated');
      if (msg.type !== 'stateUpdated') throw new Error('unreachable');
      expect(msg.state.status).toBe('finished');
      if (msg.state.status !== 'finished') throw new Error('unreachable');
      expect(msg.state.result).toBe('black-wins');
      expect(msg.state.endReason).toBe('resignation');
    }

    const room = await ports.rooms.get(roomId);
    expect(room?.state.status).toBe('finished');
  });

  it('answers a second resignation with the finished state, not an error', async () => {
    const { ports, connect } = setup();
    const alice = connect('alice');
    const roomId = await provisionRoom(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);

    await resign(ident('alice'), { type: 'resign', roomId }, ports);
    await resign(ident('alice'), { type: 'resign', roomId }, ports);

    const msg = lastOf(alice);
    expect(msg.type).toBe('stateUpdated');
    if (msg.type !== 'stateUpdated') throw new Error('unreachable');
    expect(msg.state.status).toBe('finished');
  });

  it('refuses to award a win to an empty seat', async () => {
    const { ports, connect } = setup();
    const alice = connect('alice');
    const roomId = await provisionRoom(ports, 'alice');

    await resign(ident('alice'), { type: 'resign', roomId }, ports);

    const msg = lastOf(alice);
    expect(msg.type).toBe('error');
    if (msg.type !== 'error') throw new Error('unreachable');
    expect(msg.message).toBe('no opponent to resign to');
    expect((await ports.rooms.get(roomId))?.state.status).toBe('in_progress');
  });

  it('errors on unknown rooms and when the caller is not seated', async () => {
    const { ports, connect } = setup();
    const alice = connect('alice');
    const eve = connect('eve');
    const roomId = await provisionRoom(ports, 'alice');

    await resign(ident('alice'), { type: 'resign', roomId: 'nope' }, ports);
    const aliceMsg = lastOf(alice);
    expect(aliceMsg.type).toBe('error');
    if (aliceMsg.type !== 'error') throw new Error('unreachable');
    expect(aliceMsg.message).toBe('room not found');

    await resign(ident('eve'), { type: 'resign', roomId }, ports);
    const eveMsg = lastOf(eve);
    expect(eveMsg.type).toBe('error');
    if (eveMsg.type !== 'error') throw new Error('unreachable');
    expect(eveMsg.message).toBe('not in room');
  });
});

describe('cancelRoom', () => {
  it('deletes a room nobody joined', async () => {
    const { ports, connect } = setup();
    connect('alice');
    const roomId = await provisionRoom(ports, 'alice');

    expect(await cancelRoom(ident('alice'), roomId, ports.rooms)).toBe('cancelled');
    expect(await ports.rooms.get(roomId)).toBeUndefined();
  });

  it('refuses once an opponent is seated', async () => {
    const { ports, connect } = setup();
    connect('alice');
    connect('bob');
    const roomId = await provisionRoom(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);

    expect(await cancelRoom(ident('alice'), roomId, ports.rooms)).toBe('forbidden');
    expect(await ports.rooms.get(roomId)).toBeDefined();
  });

  it('refuses a caller with no seat, and reports an unknown room', async () => {
    const { ports, connect } = setup();
    connect('alice');
    const roomId = await provisionRoom(ports, 'alice');

    expect(await cancelRoom(ident('eve'), roomId, ports.rooms)).toBe('forbidden');
    expect(await cancelRoom(ident('alice'), 'nope', ports.rooms)).toBe('not-found');
  });
});

const piece = (type: Piece['type'], color: Piece['color']): Piece => ({ type, color });

// White's queen at the origin with five of its six neighbours filled, and a
// black ant one slide away from closing the ring. Built by hand because
// playing a real game to a surround here would say nothing about archiving.
const oneMoveFromSurrounded = (): GameState => {
  const board: Board = {
    cells: new Map([
      ['0,0', [piece('queen', 'white')]],
      ['1,0', [piece('ant', 'black')]],
      ['1,-1', [piece('ant', 'black')]],
      ['0,-1', [piece('beetle', 'black')]],
      ['-1,0', [piece('spider', 'black')]],
      ['-1,1', [piece('grasshopper', 'black')]],
      ['1,1', [piece('ant', 'black')]],
      ['2,0', [piece('queen', 'black')]],
    ]),
  };
  return {
    status: 'in_progress',
    board,
    hands: {
      white: { queen: 0, ant: 3, beetle: 2, spider: 2, grasshopper: 3 },
      black: { queen: 0, ant: 1, beetle: 1, spider: 1, grasshopper: 2 },
    },
    currentPlayer: 'black',
    turnNumbers: { white: 4, black: 4 },
    history: [],
  };
};

const SURROUNDING_MOVE = {
  kind: 'relocate',
  from: { q: 1, r: 1 },
  to: { q: 0, r: 1 },
} as const;

describe('archiving a finished game', () => {
  const seatedRoom = async (ports: Ports, state: GameState): Promise<string> => {
    await ports.rooms.create({
      id: 'r1',
      state,
      players: { white: ident('alice'), black: ident('bob') },
      createdAt: new Date(1000),
      updatedAt: new Date(1000),
    });
    return 'r1';
  };

  it('records the game the move that ends it', async () => {
    const { ports } = setup();
    const roomId = await seatedRoom(ports, oneMoveFromSurrounded());

    await makeMove(
      ident('bob'),
      { type: 'makeMove', roomId, move: toWireMove(SURROUNDING_MOVE) },
      ports,
    );

    const archived = await ports.archive.get(roomId);
    expect(archived).toMatchObject({
      id: roomId,
      result: 'black-wins',
      endReason: 'queen-surrounded',
      startedAt: new Date(1000),
      moveCount: 1,
      players: {
        white: { playerId: 'alice', name: 'Alice' },
        black: { playerId: 'bob', name: 'Bob' },
      },
    });
    expect(archived?.state.status).toBe('finished');
  });

  it('archives nothing while the game is still in progress', async () => {
    const { ports } = setup();
    const roomId = await provisionRoom(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);

    const room = await ports.rooms.get(roomId);
    if (!room) throw new Error('room missing');
    const firstMove = listValidMoves(room.state)[0];
    if (!firstMove) throw new Error('no valid moves');
    await makeMove(
      ident('alice'),
      { type: 'makeMove', roomId, move: toWireMove(firstMove) },
      ports,
    );

    expect(await ports.archive.get(roomId)).toBeUndefined();
  });

  it('records a resignation, snapshotting both names', async () => {
    const { ports } = setup();
    const roomId = await provisionRoom(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);

    await resign(ident('alice'), { type: 'resign', roomId }, ports);

    expect(await ports.archive.listForPlayer('bob', { limit: 10 })).toMatchObject([
      {
        id: roomId,
        result: 'black-wins',
        endReason: 'resignation',
        players: {
          white: { playerId: 'alice', name: 'Alice' },
          black: { playerId: 'bob', name: 'Bob' },
        },
      },
    ]);
  });

  it('keeps the game playable when the archive is down', async () => {
    const { ports } = setup();
    const roomId = await provisionRoom(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);
    const broken: Ports = {
      ...ports,
      archive: {
        ...ports.archive,
        record: async () => {
          throw new Error('archive is down');
        },
      },
    };

    await resign(ident('alice'), { type: 'resign', roomId }, broken);

    const room = await ports.rooms.get(roomId);
    expect(room?.state.status).toBe('finished');
  });

  it('leaves the live archive row alone when the sweep backstops it', async () => {
    const { ports } = setup();
    const roomId = await provisionRoom(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);

    await resign(ident('alice'), { type: 'resign', roomId }, ports);
    const first = await ports.archive.get(roomId);

    const room = await ports.rooms.get(roomId);
    if (!room) throw new Error('room missing');
    await archiveFinished(touch(room, new Date(9_000_000)), ports);

    expect(await ports.archive.get(roomId)).toEqual(first);
  });
});
