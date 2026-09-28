import { describe, expect, it, vi } from 'vitest';
import { createDb } from './adapters/db/client.js';
import { createDrizzleSeekStore } from './adapters/drizzle-seek-store.js';
import { SEEK_TTL_MS, createSeek } from './domain/seek.js';
import { createTestApp } from './testing/auth-helper.js';

describe('seek sweep on boot', () => {
  it('removes an expired seek with no request made', async () => {
    const db = createDb(':memory:');
    try {
      const seeded = await createTestApp(db);
      const alice = await seeded.signIn('alice@example.test');
      const bob = await seeded.signIn('bob@example.test');
      await seeded.app.close();

      const seeks = createDrizzleSeekStore(db.db);
      const pastExpiry = new Date(Date.now() - SEEK_TTL_MS - 1000);
      await seeks.create(createSeek('stale', { playerId: alice.userId }, {}, 'pool', pastExpiry));
      await seeks.create(createSeek('fresh', { playerId: bob.userId }, {}, 'pool', new Date()));

      const booted = await createTestApp(db);
      try {
        // The boot sweep is fire-and-forget.
        await vi.waitFor(async () => {
          expect(await seeks.get('stale')).toBeUndefined();
        });
        expect(await seeks.get('fresh')).toBeDefined();
      } finally {
        await booted.app.close();
      }
    } finally {
      db.close();
    }
  });
});
