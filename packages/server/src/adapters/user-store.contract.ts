import { describe, expect, it } from 'vitest';
import type { UserStore } from '../domain/user-store.js';

export type UserStoreHarness = {
  readonly users: UserStore;
  /** An account with a profile already written, as first sign-in leaves it. */
  seedUser(id: string, name: string): Promise<void>;
  /** An account with no profile row: a pre-profiles row, or a hook that failed. */
  seedAccountWithoutProfile(id: string): Promise<void>;
  cleanup?(): void;
};

export const describeUserStoreContract = (
  name: string,
  createHarness: () => Promise<UserStoreHarness>,
): void => {
  describe(`${name} (UserStore contract)`, () => {
    const now = new Date('2026-01-01T00:00:00.000Z');
    const later = new Date('2026-01-02T00:00:00.000Z');

    const withUsers = async (fn: (h: UserStoreHarness) => Promise<void>): Promise<void> => {
      const harness = await createHarness();
      try {
        await harness.seedUser('p1', 'Alice');
        await harness.seedUser('p2', 'Bob');
        await fn(harness);
      } finally {
        harness.cleanup?.();
      }
    };

    it('returns a name per id', async () =>
      withUsers(async ({ users }) => {
        expect(await users.namesOf(['p1', 'p2'])).toEqual(
          new Map([
            ['p1', 'Alice'],
            ['p2', 'Bob'],
          ]),
        );
      }));

    it('leaves an unknown id out of the map', async () =>
      withUsers(async ({ users }) => {
        expect(await users.namesOf(['p1', 'gone'])).toEqual(new Map([['p1', 'Alice']]));
      }));

    it('answers an empty request without asking the store', async () =>
      withUsers(async ({ users }) => {
        expect(await users.namesOf([])).toEqual(new Map());
      }));

    it('reads a profile without writing one', async () =>
      withUsers(async ({ users }) => {
        expect((await users.get('p1'))?.name).toBe('Alice');
      }));

    it('returns null rather than creating a profile on a read', async () =>
      withUsers(async ({ users, seedAccountWithoutProfile }) => {
        await seedAccountWithoutProfile('fresh');

        expect(await users.get('fresh')).toBeNull();
        expect(await users.namesOf(['fresh'])).toEqual(new Map());
      }));

    it('creates a profile for an account that has none', async () =>
      withUsers(async ({ users, seedAccountWithoutProfile }) => {
        await seedAccountWithoutProfile('fresh');

        const profile = await users.ensure('fresh', now);
        expect(profile.name).toMatch(/^[a-z]+-[a-z]+$/);
        expect(profile.createdAt).toEqual(now);
        expect(await users.namesOf(['fresh'])).toEqual(new Map([['fresh', profile.name]]));
      }));

    it('leaves an existing profile alone, however often sign-in repeats it', async () =>
      withUsers(async ({ users }) => {
        const kept = await users.ensure('p1', later);
        expect(kept.name).toBe('Alice');
        expect(await users.ensure('p1', later)).toEqual(kept);
      }));

    it('renames a profile and moves updatedAt', async () =>
      withUsers(async ({ users }) => {
        const renamed = await users.rename('p1', 'Hleb', later);
        expect(renamed?.name).toBe('Hleb');
        expect(renamed?.updatedAt).toEqual(later);
        expect(await users.namesOf(['p1'])).toEqual(new Map([['p1', 'Hleb']]));
      }));

    it('leaves the other profiles alone on a rename', async () =>
      withUsers(async ({ users }) => {
        await users.rename('p1', 'Hleb', later);
        expect(await users.namesOf(['p2'])).toEqual(new Map([['p2', 'Bob']]));
      }));

    it('reports a rename of a missing account rather than creating one', async () =>
      withUsers(async ({ users }) => {
        expect(await users.rename('gone', 'Hleb', later)).toBeNull();
        expect(await users.namesOf(['gone'])).toEqual(new Map());
      }));
  });
};
