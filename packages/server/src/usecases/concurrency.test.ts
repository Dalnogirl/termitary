import { applyMove, listValidMoves, resign as resignGame } from '@termitary/engine';
import type { ServerMessage } from '@termitary/protocol';
import { toWireMove } from '@termitary/protocol';
import { describe, expect, it } from 'vitest';
import { createInMemoryConnectionRegistry } from '../adapters/in-memory-connection-registry.js';
import type { Sender } from '../domain/connection-registry.js';
import type { Identity } from '../domain/identity.js';
import type { Ports } from '../domain/ports.js';
import { ConcurrentModificationError, type RoomStore } from '../domain/room-store.js';
import { seatPlayer, touch } from '../domain/room.js';
import { createTestStores } from '../testing/stores.js';
import { cancelRoom } from './cancel-room.js';
import { createRoom } from './create-room.js';
import { joinGame } from './join-game.js';
import { makeMove } from './make-move.js';
import { MAX_SAVE_ATTEMPTS } from './retry-on-conflict.js';

const ident = (id: string): Identity => ({ playerId: id });
const PLAYERS = ['alice', 'bob', 'carol'];

type Inbox = { messages: ServerMessage[] };

const setup = () => {
  const connections = createInMemoryConnectionRegistry();
  const { rooms, archive, users, log } = createTestStores(PLAYERS);
  const ports: Ports = { rooms, connections, archive, users, log };
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

const errorIn = (inbox: Inbox): string => {
  const last = lastOf(inbox);
  if (last.type !== 'error') throw new Error(`expected an error, got ${last.type}`);
  return last.message;
};

const provision = async (ports: Ports, creator: string): Promise<string> => {
  const { roomId } = await createRoom(
    ident(creator),
    { seat: 'white' },
    ports.rooms,
    () => 'white',
  );
  await joinGame(ident(creator), { type: 'joinGame', roomId }, ports);
  return roomId;
};

const readForUpdate = async (rooms: RoomStore, roomId: string) => {
  const current = await rooms.getForUpdate(roomId);
  if (current === undefined) throw new Error(`no room ${roomId}`);
  return current;
};

const validMoveAt = async (rooms: RoomStore, roomId: string, index: number) => {
  const { value: room } = await readForUpdate(rooms, roomId);
  if (room.state.status === 'finished') throw new Error('game is over');
  const move = listValidMoves(room.state)[index];
  if (move === undefined) throw new Error(`no valid move at ${index}`);
  return move;
};

/**
 * Commits `other` between the next attempt's read and its write. The stores
 * are synchronous today, so nothing else here produces the interleave that the
 * first store doing real I/O will.
 */
const racingOnce = (ports: Ports, other: (rooms: RoomStore) => Promise<void>): Ports => {
  let raced = false;
  return {
    ...ports,
    rooms: {
      ...ports.rooms,
      save: async (room, expected) => {
        if (!raced) {
          raced = true;
          await other(ports.rooms);
        }
        await ports.rooms.save(room, expected);
      },
    },
  };
};

const playMove = async (rooms: RoomStore, roomId: string, index: number): Promise<void> => {
  const { value: room, version } = await readForUpdate(rooms, roomId);
  const move = await validMoveAt(rooms, roomId, index);
  await rooms.save(touch({ ...room, state: applyMove(room.state, move) }, new Date()), version);
};

describe('a move racing another write', () => {
  const setupGame = async () => {
    const { ports, connect } = setup();
    const alice = connect('alice');
    const bob = connect('bob');
    const roomId = await provision(ports, 'alice');
    await joinGame(ident('bob'), { type: 'joinGame', roomId }, ports);
    return { ports, alice, bob, roomId };
  };

  it('is refused rather than overwriting the move that got there first', async () => {
    const { ports, alice, bob, roomId } = await setupGame();
    const winning = await validMoveAt(ports.rooms, roomId, 0);
    const mine = await validMoveAt(ports.rooms, roomId, 1);
    const racing = racingOnce(ports, (rooms) => playMove(rooms, roomId, 0));

    await makeMove(ident('alice'), { type: 'makeMove', roomId, move: toWireMove(mine) }, racing);

    expect(errorIn(alice)).toBe('not your turn');
    // The winner's move is the only one stored, and the loser's was never
    // announced to either player.
    const stored = await ports.rooms.get(roomId);
    expect(stored?.state.history).toEqual([winning]);
    expect(bob.messages.filter((m) => m.type === 'stateUpdated')).toHaveLength(0);
  });

  it('does not revive a game the opponent resigned in the meantime', async () => {
    const { ports, alice, roomId } = await setupGame();
    const mine = await validMoveAt(ports.rooms, roomId, 0);
    const racing = racingOnce(ports, async (rooms) => {
      const { value: room, version } = await readForUpdate(rooms, roomId);
      await rooms.save(
        touch({ ...room, state: resignGame(room.state, 'black') }, new Date()),
        version,
      );
    });

    await makeMove(ident('alice'), { type: 'makeMove', roomId, move: toWireMove(mine) }, racing);

    expect(errorIn(alice)).toBe('game already finished');
    expect((await ports.rooms.get(roomId))?.state.status).toBe('finished');
  });

  it('gives up once the attempts run out', async () => {
    const { ports, roomId } = await setupGame();
    const mine = await validMoveAt(ports.rooms, roomId, 0);
    let attempts = 0;
    const alwaysConflicts: Ports = {
      ...ports,
      rooms: {
        ...ports.rooms,
        save: async (room) => {
          attempts += 1;
          throw new ConcurrentModificationError(room.id);
        },
      },
    };

    await expect(
      makeMove(
        ident('alice'),
        { type: 'makeMove', roomId, move: toWireMove(mine) },
        alwaysConflicts,
      ),
    ).rejects.toBeInstanceOf(ConcurrentModificationError);
    expect(attempts).toBe(MAX_SAVE_ATTEMPTS);
    expect((await ports.rooms.get(roomId))?.state.history).toHaveLength(0);
  });
});

describe('a join racing another write', () => {
  const setupOpenRoom = async () => {
    const { ports, connect } = setup();
    const bob = connect('bob');
    const roomId = await provision(ports, 'alice');
    return { ports, bob, roomId };
  };

  it('does not put two players in one seat', async () => {
    const { ports, bob, roomId } = await setupOpenRoom();
    const racing = racingOnce(ports, async (rooms) => {
      const { value: room, version } = await readForUpdate(rooms, roomId);
      await rooms.save(touch(seatPlayer(room, ident('carol')), new Date()), version);
    });

    await joinGame(ident('bob'), { type: 'joinGame', roomId }, racing);

    expect(errorIn(bob)).toBe('room is full');
    expect((await ports.rooms.get(roomId))?.players.black).toEqual(ident('carol'));
  });

  it('does not bring back a room cancelled in the meantime', async () => {
    const { ports, bob, roomId } = await setupOpenRoom();
    const racing = racingOnce(ports, async (rooms) => {
      expect(await cancelRoom(ident('alice'), roomId, rooms)).toBe('cancelled');
    });

    await joinGame(ident('bob'), { type: 'joinGame', roomId }, racing);

    expect(errorIn(bob)).toBe('room not found');
    expect(await ports.rooms.get(roomId)).toBeUndefined();
  });
});
