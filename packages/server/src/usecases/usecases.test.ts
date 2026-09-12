import { listValidMoves } from '@termitary/engine';
import type { ServerMessage } from '@termitary/protocol';
import { fromWire, toWireMove } from '@termitary/protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryConnectionRegistry } from '../adapters/in-memory-connection-registry.js';
import { createInMemoryRoomStore } from '../adapters/in-memory-room-store.js';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { createRoom } from './create-room.js';
import { joinGame } from './join-game.js';
import { leaveGame } from './leave-game.js';
import { makeMove } from './make-move.js';

const ident = (id: string): Identity => ({ playerId: id });

type Inbox = { messages: ServerMessage[] };

const setup = () => {
  const connections = createInMemoryConnectionRegistry();
  const ports: Ports = {
    rooms: createInMemoryRoomStore(),
    connections,
  };
  const inboxes = new Map<string, Inbox>();
  const connect = (playerId: string): Inbox => {
    const inbox: Inbox = { messages: [] };
    inboxes.set(playerId, inbox);
    connections.bind(playerId, async (msg) => {
      inbox.messages.push(msg);
    });
    return inbox;
  };
  const disconnect = (playerId: string): void => {
    connections.unbind(playerId);
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
  const { roomId } = await createRoom(ident(creator), ports.rooms);
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
    expect(bobMsg.opponent).toBe('connected');

    const aliceKinds = alice.messages.map((m) => m.type);
    expect(aliceKinds).toContain('stateUpdated');
    expect(aliceKinds).toContain('presenceUpdate');
    const alicePresence = alice.messages.find((m) => m.type === 'presenceUpdate');
    if (alicePresence?.type !== 'presenceUpdate') throw new Error('unreachable');
    expect(alicePresence.opponent).toBe('connected');

    const stored = await ports.rooms.get(roomId);
    expect(stored?.players.black?.playerId).toBe('bob');
  });

  it('reports opponent=empty in gameJoined when joining a one-seat room alone', async () => {
    // provisionRoom() already re-attached alice; here we just inspect the
    // message she received from that initial joinGame call.
    const aliceJoined = alice.messages.find((m) => m.type === 'gameJoined');
    if (aliceJoined?.type !== 'gameJoined') throw new Error('unreachable');
    expect(aliceJoined.opponent).toBe('empty');
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
    expect(msg.opponent).toBe('disconnected');
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
    expect(msg.opponent).toBe('connected');
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

describe('leaveGame', () => {
  it('notifies the opponent and deletes the room', async () => {
    const { ports, connect } = setup();
    connect('alice');
    const bob = connect('bob');
    const roomId = await provisionRoom(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);

    await leaveGame(ident('alice'), { type: 'leaveGame', roomId }, ports);

    const bobMsg = lastOf(bob);
    expect(bobMsg.type).toBe('error');
    if (bobMsg.type !== 'error') throw new Error('unreachable');
    expect(bobMsg.message).toBe('opponent left');
    expect(await ports.rooms.get(roomId)).toBeUndefined();
  });

  it('is silent on unknown rooms (idempotent leave)', async () => {
    const { ports, connect } = setup();
    const alice = connect('alice');
    await leaveGame(ident('alice'), { type: 'leaveGame', roomId: 'nope' }, ports);
    expect(alice.messages).toEqual([]);
  });

  it('errors when the caller is not seated in the room', async () => {
    const { ports, connect } = setup();
    connect('alice');
    const eve = connect('eve');
    const roomId = await provisionRoom(ports, 'alice');
    await leaveGame(ident('eve'), { type: 'leaveGame', roomId }, ports);
    const msg = lastOf(eve);
    expect(msg.type).toBe('error');
    if (msg.type !== 'error') throw new Error('unreachable');
    expect(msg.message).toBe('not in room');
  });
});
