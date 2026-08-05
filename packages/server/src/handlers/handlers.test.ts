import { listValidMoves } from '@hive/engine';
import type { ServerMessage } from '@hive/protocol';
import { fromWire, toWireMove } from '@hive/protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryConnectionRegistry } from '../adapters/in-memory-connection-registry.js';
import { createInMemoryRoomStore } from '../adapters/in-memory-room-store.js';
import type { Identity } from '../domain/identity.js';
import type { Services } from '../domain/services.js';
import { handleCreateGame } from './create-game.js';
import { handleJoinGame } from './join-game.js';
import { handleLeaveGame } from './leave-game.js';
import { handleMakeMove } from './make-move.js';

const ident = (id: string): Identity => ({ playerId: id });

type Inbox = { messages: ServerMessage[] };

const setup = () => {
  const services: Services = {
    rooms: createInMemoryRoomStore(),
    connections: createInMemoryConnectionRegistry(),
  };
  const inboxes = new Map<string, Inbox>();
  const connect = (playerId: string): Inbox => {
    const inbox: Inbox = { messages: [] };
    inboxes.set(playerId, inbox);
    (services.connections as ReturnType<typeof createInMemoryConnectionRegistry>).bind(
      playerId,
      async (msg) => {
        inbox.messages.push(msg);
      },
    );
    return inbox;
  };
  return { services, connect, inboxes };
};

const lastOf = (inbox: Inbox): ServerMessage => {
  const m = inbox.messages.at(-1);
  if (!m) throw new Error('inbox empty');
  return m;
};

const roomIdFromCreated = (inbox: Inbox): string => {
  const m = lastOf(inbox);
  if (m.type !== 'gameCreated') throw new Error(`expected gameCreated, got ${m.type}`);
  return m.roomId;
};

describe('handleCreateGame', () => {
  it('creates a room, seats the creator as white, sends gameCreated', async () => {
    const { services, connect } = setup();
    const alice = connect('alice');
    await handleCreateGame(ident('alice'), { type: 'createGame' }, services);

    const msg = lastOf(alice);
    expect(msg.type).toBe('gameCreated');
    if (msg.type !== 'gameCreated') throw new Error('unreachable');
    expect(msg.playerColor).toBe('white');
    expect(msg.state.status).toBe('in_progress');
    expect(fromWire(msg.state).currentPlayer).toBe('white');

    const stored = await services.rooms.get(msg.roomId);
    expect(stored?.players[0]?.playerId).toBe('alice');
    expect(stored?.players[1]).toBeUndefined();
  });
});

describe('handleJoinGame', () => {
  let services: Services;
  let alice: Inbox;
  let bob: Inbox;
  let connect: (id: string) => Inbox;
  let roomId: string;

  beforeEach(async () => {
    ({ services, connect } = setup());
    alice = connect('alice');
    bob = connect('bob');
    await handleCreateGame(ident('alice'), { type: 'createGame' }, services);
    roomId = roomIdFromCreated(alice);
  });

  it('seats the joiner as black and notifies both players', async () => {
    await handleJoinGame(ident('bob'), { type: 'joinGame', roomId }, services);

    const bobMsg = lastOf(bob);
    expect(bobMsg.type).toBe('gameJoined');
    if (bobMsg.type !== 'gameJoined') throw new Error('unreachable');
    expect(bobMsg.playerColor).toBe('black');
    expect(bobMsg.roomId).toBe(roomId);

    const aliceMsg = lastOf(alice);
    expect(aliceMsg.type).toBe('stateUpdated');

    const stored = await services.rooms.get(roomId);
    expect(stored?.players[1]?.playerId).toBe('bob');
  });

  it('errors when the room does not exist', async () => {
    await handleJoinGame(ident('bob'), { type: 'joinGame', roomId: 'nope' }, services);
    const msg = lastOf(bob);
    expect(msg.type).toBe('error');
    if (msg.type !== 'error') throw new Error('unreachable');
    expect(msg.message).toBe('room not found');
  });

  it('errors when the room is full', async () => {
    await handleJoinGame(ident('bob'), { type: 'joinGame', roomId }, services);
    const carol = connect('carol');
    await handleJoinGame(ident('carol'), { type: 'joinGame', roomId }, services);
    const msg = lastOf(carol);
    expect(msg.type).toBe('error');
    if (msg.type !== 'error') throw new Error('unreachable');
    expect(msg.message).toBe('room is full');
  });

  it('errors when the joiner is the creator', async () => {
    await handleJoinGame(ident('alice'), { type: 'joinGame', roomId }, services);
    const msg = lastOf(alice);
    expect(msg.type).toBe('error');
    if (msg.type !== 'error') throw new Error('unreachable');
    expect(msg.message).toBe('already in room');
  });
});

describe('handleMakeMove', () => {
  it('applies a legal move and broadcasts new state to both players', async () => {
    const { services, connect } = setup();
    const alice = connect('alice');
    const bob = connect('bob');
    await handleCreateGame(ident('alice'), { type: 'createGame' }, services);
    const roomId = roomIdFromCreated(alice);
    await handleJoinGame(ident('bob'), { type: 'joinGame', roomId }, services);

    const room = await services.rooms.get(roomId);
    if (!room) throw new Error('room missing');
    const firstMove = listValidMoves(room.state)[0];
    if (!firstMove) throw new Error('no valid moves');
    await handleMakeMove(
      ident('alice'),
      { type: 'makeMove', roomId, move: toWireMove(firstMove) },
      services,
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
    const { services, connect } = setup();
    const alice = connect('alice');
    const bob = connect('bob');
    await handleCreateGame(ident('alice'), { type: 'createGame' }, services);
    const roomId = roomIdFromCreated(alice);
    await handleJoinGame(ident('bob'), { type: 'joinGame', roomId }, services);

    const room = await services.rooms.get(roomId);
    if (!room) throw new Error('room missing');
    const aliceMove = listValidMoves(room.state)[0];
    if (!aliceMove) throw new Error('no valid moves');
    await handleMakeMove(
      ident('bob'),
      { type: 'makeMove', roomId, move: toWireMove(aliceMove) },
      services,
    );

    const bobMsg = lastOf(bob);
    expect(bobMsg.type).toBe('error');
    if (bobMsg.type !== 'error') throw new Error('unreachable');
    expect(bobMsg.message).toBe('not your turn');
  });

  it('rejects an illegal move with the engine error message', async () => {
    const { services, connect } = setup();
    const alice = connect('alice');
    const bob = connect('bob');
    await handleCreateGame(ident('alice'), { type: 'createGame' }, services);
    const roomId = roomIdFromCreated(alice);
    await handleJoinGame(ident('bob'), { type: 'joinGame', roomId }, services);

    await handleMakeMove(
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
      services,
    );

    const msg = lastOf(alice);
    expect(msg.type).toBe('error');
  });

  it('rejects moves on unknown rooms and when the caller is not seated', async () => {
    const { services, connect } = setup();
    const alice = connect('alice');
    const eve = connect('eve');
    await handleCreateGame(ident('alice'), { type: 'createGame' }, services);
    const roomId = roomIdFromCreated(alice);

    await handleMakeMove(
      ident('alice'),
      { type: 'makeMove', roomId: 'nope', move: { kind: 'pass' } },
      services,
    );
    expect(lastOf(alice).type).toBe('error');

    await handleMakeMove(
      ident('eve'),
      { type: 'makeMove', roomId, move: { kind: 'pass' } },
      services,
    );
    const eveMsg = lastOf(eve);
    expect(eveMsg.type).toBe('error');
    if (eveMsg.type !== 'error') throw new Error('unreachable');
    expect(eveMsg.message).toBe('not in room');
  });
});

describe('handleLeaveGame', () => {
  it('notifies the opponent and deletes the room', async () => {
    const { services, connect } = setup();
    const alice = connect('alice');
    const bob = connect('bob');
    await handleCreateGame(ident('alice'), { type: 'createGame' }, services);
    const roomId = roomIdFromCreated(alice);
    await handleJoinGame(ident('bob'), { type: 'joinGame', roomId }, services);

    await handleLeaveGame(ident('alice'), { type: 'leaveGame', roomId }, services);

    const bobMsg = lastOf(bob);
    expect(bobMsg.type).toBe('error');
    if (bobMsg.type !== 'error') throw new Error('unreachable');
    expect(bobMsg.message).toBe('opponent left');
    expect(await services.rooms.get(roomId)).toBeUndefined();
  });

  it('is a silent no-op on unknown rooms', async () => {
    const { services, connect } = setup();
    const alice = connect('alice');
    await handleLeaveGame(ident('alice'), { type: 'leaveGame', roomId: 'nope' }, services);
    expect(alice.messages).toEqual([]);
  });
});
