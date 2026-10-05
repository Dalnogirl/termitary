import type { TimeControl } from '@termitary/clock';
import { BASE_RULESET } from '@termitary/engine';
import type { ServerMessage } from '@termitary/protocol';
import { beforeEach, describe, expect, it } from 'vitest';
import { createInMemoryConnectionRegistry } from '../adapters/in-memory-connection-registry.js';
import { createPairedRoom } from '../domain/room.js';
import { startedRoom } from '../testing/rooms.js';
import { type TestStores, createTestStores } from '../testing/stores.js';
import { type RoomSweepPorts, sweepTimedOutRooms } from './sweep-timed-out-rooms.js';

const ident = (id: string) => ({ playerId: id });
const BLITZ: TimeControl = { kind: 'realtime', initialMs: 300_000, incrementMs: 3_000 };
// 'late' is paired at 0 and both sides move at 1s and 2s, so white's bank runs
// out at 302s. 'unstarted' is paired at 280s and white's first-move window
// closes at 310s. 'fresh' is paired at 300s and has time left at both.
const FLAGGED_AT = new Date(302_000);
const ABANDONED_AT = new Date(310_000);

const timedRoom = (id: string, pairedAt: number) =>
  createPairedRoom(id, ident('alice'), ident('bob'), new Date(pairedAt), BASE_RULESET, BLITZ);

describe('sweepTimedOutRooms', () => {
  let stores: TestStores;
  let connections: ReturnType<typeof createInMemoryConnectionRegistry>;
  let ports: RoomSweepPorts;

  const listen = async (playerId: string, roomId: string): Promise<ServerMessage[]> => {
    const heard: ServerMessage[] = [];
    connections.bind(playerId, async (msg) => {
      heard.push(msg);
    });
    await connections.joinRoom(playerId, roomId);
    return heard;
  };

  beforeEach(async () => {
    stores = createTestStores(['alice', 'bob']);
    connections = createInMemoryConnectionRegistry();
    ports = { ...stores, connections };
    await stores.rooms.create(startedRoom(timedRoom('late', 0)));
    await stores.rooms.create(timedRoom('unstarted', 280_000));
    await stores.rooms.create(timedRoom('fresh', 300_000));
  });

  it('archives a room past its deadline as a timeout and leaves one inside it', async () => {
    expect(await sweepTimedOutRooms(ports, FLAGGED_AT)).toEqual({ finished: 1, aborted: 0 });

    const archived = await stores.archive.get('late');
    expect(archived?.endReason).toBe('timeout');
    expect(archived?.finishedAt).toEqual(FLAGGED_AT);
    expect(await stores.rooms.get('late')).toBeUndefined();
    expect((await stores.rooms.get('unstarted'))?.state.status).toBe('in_progress');
    expect((await stores.rooms.get('fresh'))?.state.status).toBe('in_progress');
  });

  it('deletes a room whose first move was missed and archives nothing', async () => {
    expect(await sweepTimedOutRooms(ports, ABANDONED_AT)).toEqual({ finished: 1, aborted: 1 });

    expect(await stores.rooms.get('unstarted')).toBeUndefined();
    expect(await stores.archive.get('unstarted')).toBeUndefined();
    expect(await stores.rooms.get('fresh')).toBeDefined();
  });

  it('tells a player still connected that the game is over', async () => {
    const heard = await listen('bob', 'late');

    await sweepTimedOutRooms(ports, FLAGGED_AT);

    expect(heard.at(-1)).toMatchObject({
      type: 'stateUpdated',
      state: { status: 'finished', endReason: 'timeout' },
    });
  });

  it('tells a player still connected that the game was aborted', async () => {
    const heard = await listen('bob', 'unstarted');

    await sweepTimedOutRooms(ports, ABANDONED_AT);

    expect(heard.at(-1)).toEqual({ type: 'gameAborted', roomId: 'unstarted' });
  });

  it('ends the rest when one room cannot be read', async () => {
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

    expect(await sweepTimedOutRooms(unreadable, ABANDONED_AT)).toEqual({
      finished: 0,
      aborted: 1,
    });
    expect(await stores.rooms.get('unstarted')).toBeUndefined();
  });
});
