import { describe, expect, it, vi } from 'vitest';
import { createDb } from './adapters/db/client.js';
import { createDrizzleRoomStore } from './adapters/drizzle-room-store.js';
import { createRoom } from './domain/room.js';
import { createTestApp } from './testing/auth-helper.js';
import { ABANDONED_ROOM_TTL_MS } from './usecases/sweep-abandoned-rooms.js';

// The issue's done-when: a stale room goes away without anyone opening the
// lobby. Booting a second app on the same database stands in for a restart.
describe('room sweep on boot', () => {
  it('removes a stale room without a request', async () => {
    const db = createDb(':memory:');
    try {
      const first = await createTestApp(db);
      const alice = await first.signIn('alice@example.test');
      await first.app.close();

      // Written a day and a second ago, by a store whose clock says so.
      const stale = new Date(Date.now() - ABANDONED_ROOM_TTL_MS - 1000);
      const seeding = createDrizzleRoomStore(db.db, () => stale);
      await seeding.create(createRoom('stale-room', { playerId: alice.userId }));
      await seeding.create(createRoom('fresh-room', { playerId: alice.userId }));
      // Touch one of them now, so only the other is past the cutoff.
      await createDrizzleRoomStore(db.db).save(
        createRoom('fresh-room', { playerId: alice.userId }),
      );

      const second = await createTestApp(db);
      try {
        const reader = createDrizzleRoomStore(db.db);
        // The boot sweep is fire-and-forget, so wait for it rather than
        // assuming it finished before buildApp returned.
        await vi.waitFor(async () => {
          expect(await reader.get('stale-room')).toBeUndefined();
        });
        expect(await reader.get('fresh-room')).toBeDefined();
      } finally {
        await second.app.close();
      }
    } finally {
      db.close();
    }
  });
});
