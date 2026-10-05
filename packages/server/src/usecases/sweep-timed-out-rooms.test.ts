import type { TimeControl } from '@termitary/clock';
import { BASE_RULESET } from '@termitary/engine';
import type { ServerMessage } from '@termitary/protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryConnectionRegistry } from '../adapters/in-memory-connection-registry.js';
import { createPairedRoom } from '../domain/room.js';
import { type TestStores, createTestStores } from '../testing/stores.js';
import { type RoomSweepPorts, sweepTimedOutRooms } from './sweep-timed-out-rooms.js';

const ident = (id: string) => ({ playerId: id });
const BLITZ: TimeControl = { kind: 'realtime', initialMs: 300_000, incrementMs: 3_000 };
// Nobody moves, so white's first-move window closes 30s after pairing.
const OVERDUE_AT = new Date(30_000);

const timedRoom = (id: string, pairedAt: number) =>
  createPairedRoom(id, ident('alice'), ident('bob'), new Date(pairedAt), BASE_RULESET, BLITZ);

describe('sweepTimedOutRooms', () => {
  let stores: TestStores;
  let connections: ReturnType<typeof createInMemoryConnectionRegistry>;
  let ports: RoomSweepPorts;

  beforeEach(async () => {
    stores = createTestStores(['alice', 'bob']);
    connections = createInMemoryConnectionRegistry();
    ports = { ...stores, connections };
    await stores.rooms.create(timedRoom('late', 0));
    await stores.rooms.create(timedRoom('fresh', 1));
  });

  it('archives a room past its deadline as a timeout and leaves one inside it', async () => {
    expect(await sweepTimedOutRooms(ports, OVERDUE_AT)).toBe(1);

    const archived = await stores.archive.get('late');
    expect(archived?.endReason).toBe('timeout');
    expect(archived?.finishedAt).toEqual(OVERDUE_AT);
    expect(await stores.rooms.get('late')).toBeUndefined();
    expect((await stores.rooms.get('fresh'))?.state.status).toBe('in_progress');
  });

  it('tells a player still connected that the game is over', async () => {
    const heard: ServerMessage[] = [];
    connections.bind('bob', async (msg) => {
      heard.push(msg);
    });
    await ports.connections.joinRoom('bob', 'late');

    await sweepTimedOutRooms(ports, OVERDUE_AT);

    expect(heard.at(-1)).toMatchObject({
      type: 'stateUpdated',
      state: { status: 'finished', endReason: 'timeout' },
    });
  });

  it('finishes the rest when one room cannot be read', async () => {
    const unreadable: RoomSweepPorts = {
      ...ports,
      rooms: {
        ...ports.rooms,
        getForUpdate: async (id) => {
          if (id === 'late') throw new Error('corrupt row');
          return ports.rooms.getForUpdate(id);
        },
      },
    };

    expect(await sweepTimedOutRooms(unreadable, new Date(30_001))).toBe(1);
    expect(await stores.archive.get('fresh')).toBeDefined();
  });
});
