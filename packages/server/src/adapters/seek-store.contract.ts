import type { SeekPreference } from '@termitary/protocol';
import { describe, expect, it } from 'vitest';
import type { SeekStore } from '../domain/seek-store.js';
import { type Seek, type SeekVisibility, createSeek } from '../domain/seek.js';

export type SeekStoreHarness = {
  readonly store: SeekStore;
  /** The seeker is a foreign key in persisting stores; the id has to exist. */
  seedUser(id: string): Promise<void>;
  cleanup?(): void;
};

const at = (ms: number) => new Date(ms);

const seekAt = (
  id: string,
  seeker: string,
  ms: number,
  preference: SeekPreference = {},
  visibility: SeekVisibility = 'pool',
): Seek => createSeek(id, { playerId: seeker }, preference, visibility, at(ms));

const idsOf = (seeks: readonly Seek[]) => seeks.map((seek) => seek.id);

// Anything asserted here belongs to the port, not to an implementation.
export const describeSeekStoreContract = (
  name: string,
  createHarness: () => Promise<SeekStoreHarness>,
): void => {
  describe(`${name} (SeekStore contract)`, () => {
    const withStore = async (fn: (h: SeekStoreHarness) => Promise<void>): Promise<void> => {
      const harness = await createHarness();
      try {
        await harness.seedUser('p1');
        await harness.seedUser('p2');
        await harness.seedUser('p3');
        await fn(harness);
      } finally {
        harness.cleanup?.();
      }
    };

    it('create + get round-trips, preference included', async () =>
      withStore(async ({ store }) => {
        const seek = seekAt('s1', 'p1', 1000, { pillbug: 'require', mosquito: 'exclude' });
        await store.create(seek);
        expect(await store.get('s1')).toEqual(seek);
      }));

    it('get is undefined for an id nothing wrote', async () =>
      withStore(async ({ store }) => {
        expect(await store.get('nope')).toBeUndefined();
      }));

    it('lists the pool oldest first, so the longest wait pairs next', async () =>
      withStore(async ({ store }) => {
        await store.create(seekAt('newer', 'p1', 3000));
        await store.create(seekAt('older', 'p2', 1000));
        expect(idsOf(await store.listPool('p3', at(2_000_000)))).toEqual(['older', 'newer']);
      }));

    it('keeps your own seeks out of the pool you match against', async () =>
      withStore(async ({ store }) => {
        await store.create(seekAt('mine', 'p1', 1000));
        await store.create(seekAt('theirs', 'p2', 2000));
        expect(idsOf(await store.listPool('p1', at(2_000_000)))).toEqual(['theirs']);
      }));

    it('keeps private seeks out of the pool', async () =>
      withStore(async ({ store }) => {
        await store.create(seekAt('hidden', 'p2', 1000, {}, 'private'));
        await store.create(seekAt('listed', 'p3', 2000));
        expect(idsOf(await store.listPool('p1', at(2_000_000)))).toEqual(['listed']);
      }));

    it('keeps expired seeks out of the pool without deleting them', async () =>
      withStore(async ({ store }) => {
        const stale = seekAt('stale', 'p2', 1000);
        await store.create(stale);
        const afterExpiry = new Date(stale.expiresAt.getTime() + 1);

        expect(await store.listPool('p1', afterExpiry)).toEqual([]);
        expect(await store.get('stale')).toEqual(stale);
      }));

    it('gives you your own seek, private included, and nobody else', async () =>
      withStore(async ({ store }) => {
        const mine = seekAt('mine', 'p1', 1000, {}, 'private');
        await store.create(mine);
        await store.create(seekAt('theirs', 'p2', 2000));

        expect(await store.getFor('p1', at(2000))).toEqual(mine);
        expect(await store.getFor('nobody', at(2000))).toBeUndefined();
      }));

    it('hides your seek once it has expired', async () =>
      withStore(async ({ store }) => {
        const stale = seekAt('stale', 'p1', 1000);
        await store.create(stale);
        expect(await store.getFor('p1', new Date(stale.expiresAt.getTime() + 1))).toBeUndefined();
      }));

    it('refuses a second seek for the same player', async () =>
      withStore(async ({ store }) => {
        await store.create(seekAt('first', 'p1', 1000));
        await expect(store.create(seekAt('second', 'p1', 2000))).rejects.toThrow();
      }));

    it('deleteFor clears the seat whatever state the seek is in', async () =>
      withStore(async ({ store }) => {
        const stale = seekAt('stale', 'p1', 1000);
        await store.create(stale);
        await store.create(seekAt('theirs', 'p2', 1000));

        // Expired, so getFor already hides it, but it still holds the row.
        await store.deleteFor('p1');

        expect(await store.get('stale')).toBeUndefined();
        expect(await store.get('theirs')).toBeDefined();
        await expect(store.create(seekAt('again', 'p1', 5000))).resolves.toBeUndefined();
      }));

    it('deleteFor is quiet for a player with no seek', async () =>
      withStore(async ({ store }) => {
        await expect(store.deleteFor('nobody')).resolves.toBeUndefined();
      }));

    it('claim returns the seek and removes it', async () =>
      withStore(async ({ store }) => {
        const seek = seekAt('s1', 'p1', 1000, { ladybug: 'require' });
        await store.create(seek);

        expect(await store.claim('s1')).toEqual(seek);
        expect(await store.get('s1')).toBeUndefined();
      }));

    // The race the whole port exists for: two players hitting one seek must
    // produce one game and one loser, never two games over the same row.
    it('gives one winner when two callers claim the same seek at once', async () =>
      withStore(async ({ store }) => {
        await store.create(seekAt('s1', 'p1', 1000));

        const claims = await Promise.all([store.claim('s1'), store.claim('s1')]);

        expect(claims.filter((claim) => claim !== undefined)).toHaveLength(1);
        expect(claims.filter((claim) => claim === undefined)).toHaveLength(1);
      }));

    it('claim is undefined for a seek that is already gone', async () =>
      withStore(async ({ store }) => {
        expect(await store.claim('never-existed')).toBeUndefined();
      }));

    it('sweeps expired seeks and leaves the rest, counting what it removed', async () =>
      withStore(async ({ store }) => {
        const stale = seekAt('stale', 'p1', 1000);
        await store.create(stale);
        await store.create(seekAt('live', 'p2', 1000 + stale.expiresAt.getTime()));

        expect(await store.deleteExpiredBefore(new Date(stale.expiresAt.getTime() + 1))).toBe(1);
        expect(await store.get('stale')).toBeUndefined();
        expect(await store.get('live')).toBeDefined();
      }));

    it('sweeps a seek exactly at its expiry, so the pool and the sweep agree', async () =>
      withStore(async ({ store }) => {
        const seek = seekAt('s1', 'p1', 1000);
        await store.create(seek);

        expect(await store.listPool('p2', seek.expiresAt)).toEqual([]);
        expect(await store.deleteExpiredBefore(seek.expiresAt)).toBe(1);
      }));
  });
};
