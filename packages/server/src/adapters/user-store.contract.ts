import { describe, expect, it } from 'vitest';
import type { UserStore } from '../domain/user-store.js';

export type UserStoreHarness = {
  readonly users: UserStore;
  seedUser(id: string, name: string): Promise<void>;
  cleanup?(): void;
};

export const describeUserStoreContract = (
  name: string,
  createHarness: () => Promise<UserStoreHarness>,
): void => {
  describe(`${name} (UserStore contract)`, () => {
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
  });
};
