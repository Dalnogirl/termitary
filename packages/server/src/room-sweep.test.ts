import { describe, expect, it, vi } from 'vitest';
import { type DbHandle, createDb } from './adapters/db/client.js';
import { createDrizzleRoomStore } from './adapters/drizzle-room-store.js';
import { createRoom } from './domain/room.js';
import { createTestApp } from './testing/auth-helper.js';
import { ABANDONED_ROOM_TTL_MS } from './usecases/sweep-abandoned-rooms.js';

const writeRoomAt = (db: DbHandle, id: string, ownerId: string, at: Date): Promise<void> =>
  createDrizzleRoomStore(db.db, () => at).create(createRoom(id, { playerId: ownerId }));

describe('room sweep on boot', () => {
  it('removes a stale room with no request made', async () => {
    const db = createDb(':memory:');
    try {
      const seeded = await createTestApp(db);
      const { userId } = await seeded.signIn('alice@example.test');
      await seeded.app.close();

      const pastTheCutoff = new Date(Date.now() - ABANDONED_ROOM_TTL_MS - 1000);
      await writeRoomAt(db, 'stale-room', userId, pastTheCutoff);
      await writeRoomAt(db, 'fresh-room', userId, new Date());

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
