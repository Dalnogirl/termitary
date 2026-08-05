import { describe, expect, it } from 'vitest';
import { createInMemoryRoomStore } from '../adapters/in-memory-room-store.js';
import { createRoom } from './create-room.js';

describe('createRoom use case', () => {
  it('creates a room, seats the caller as white, returns the id', async () => {
    const rooms = createInMemoryRoomStore();
    const { roomId } = await createRoom({ playerId: 'alice' }, rooms);

    const stored = await rooms.get(roomId);
    expect(stored).toBeDefined();
    expect(stored?.players[0]?.playerId).toBe('alice');
    expect(stored?.players[1]).toBeUndefined();
    expect(stored?.state.status).toBe('in_progress');
  });

  it('returns a distinct roomId on each invocation', async () => {
    const rooms = createInMemoryRoomStore();
    const a = await createRoom({ playerId: 'alice' }, rooms);
    const b = await createRoom({ playerId: 'alice' }, rooms);
    expect(a.roomId).not.toBe(b.roomId);
  });

  it('does not touch the connection registry (no WS context)', async () => {
    // Implicit assertion: createRoom takes only `rooms`, not `Ports`. If a
    // future change re-introduces a connections dependency, this test will
    // fail to compile.
    const rooms = createInMemoryRoomStore();
    await createRoom({ playerId: 'alice' }, rooms);
  });
});
