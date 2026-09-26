import { describe, expect, it, vi } from 'vitest';
import { type DbHandle, createDb } from './adapters/db/client.js';
import { createDrizzleRoomStore } from './adapters/drizzle-room-store.js';
import { createPairedRoom, touch } from './domain/room.js';
import { createTestApp } from './testing/auth-helper.js';
import { FINISHED_ROOM_TTL_MS } from './usecases/sweep-finished-rooms.js';

const FINISHED = { status: 'finished', result: 'draw', endReason: 'queen-surrounded' } as const;

const writeFinishedAt = (
  db: DbHandle,
  id: string,
  [white, black]: readonly [string, string],
  at: Date,
): Promise<void> => {
  const room = createPairedRoom(id, { playerId: white }, { playerId: black }, at);
  return createDrizzleRoomStore(db.db).create(
    touch({ ...room, state: { ...room.state, ...FINISHED } }, at),
  );
};

describe('room sweep on boot', () => {
  it('removes a stale finished room with no request made', async () => {
    const db = createDb(':memory:');
    try {
      const seeded = await createTestApp(db);
      const alice = await seeded.signIn('alice@example.test');
      const bob = await seeded.signIn('bob@example.test');
      await seeded.app.close();

      const players = [alice.userId, bob.userId] as const;
      const pastTheCutoff = new Date(Date.now() - FINISHED_ROOM_TTL_MS - 1000);
      await writeFinishedAt(db, 'stale-room', players, pastTheCutoff);
      await writeFinishedAt(db, 'fresh-room', players, new Date());

      const booted = await createTestApp(db);
      const rooms = createDrizzleRoomStore(db.db);
      try {
        // The boot sweep is fire-and-forget.
        await vi.waitFor(async () => {
          expect(await rooms.get('stale-room')).toBeUndefined();
        });
        expect(await rooms.get('fresh-room')).toBeDefined();
      } finally {
        await booted.app.close();
      }
    } finally {
      db.close();
    }
  });
});
