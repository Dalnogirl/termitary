import { BASE_RULESET } from '@termitary/engine';
import { describe, expect, it, vi } from 'vitest';
import { createDb } from './adapters/db/client.js';
import { createDrizzleArchivedGameStore } from './adapters/drizzle-archived-game-store.js';
import { createDrizzleRoomStore } from './adapters/drizzle-room-store.js';
import { createDrizzleSeekStore } from './adapters/drizzle-seek-store.js';
import { createPairedRoom } from './domain/room.js';
import { SEEK_TTL_MS, createSeek } from './domain/seek.js';
import { createTestApp } from './testing/auth-helper.js';
import { startedRoom } from './testing/rooms.js';

describe('sweep on boot', () => {
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

  it('finishes a game whose clock ran out with no request made', async () => {
    const db = createDb(':memory:');
    try {
      const seeded = await createTestApp(db);
      const alice = await seeded.signIn('alice@example.test');
      const bob = await seeded.signIn('bob@example.test');
      await seeded.app.close();

      const rooms = createDrizzleRoomStore(db.db);
      const blitz = { kind: 'realtime', initialMs: 300_000, incrementMs: 0 } as const;
      const white = { playerId: alice.userId };
      const black = { playerId: bob.userId };
      const anHourAgo = new Date(Date.now() - 60 * 60_000);
      await rooms.create(
        startedRoom(createPairedRoom('late', white, black, anHourAgo, BASE_RULESET, blitz)),
      );
      await rooms.create(createPairedRoom('fresh', white, black, new Date(), BASE_RULESET, blitz));

      const booted = await createTestApp(db);
      try {
        const archive = createDrizzleArchivedGameStore(db.db);
        await vi.waitFor(async () => {
          expect((await archive.get('late'))?.endReason).toBe('timeout');
        });
        expect(await rooms.get('fresh')).toBeDefined();
      } finally {
        await booted.app.close();
      }
    } finally {
      db.close();
    }
  });
});
