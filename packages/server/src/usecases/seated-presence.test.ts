import { describe, expect, it } from 'vitest';
import type { UserStore } from '../domain/user-store.js';
import { seatedPresence } from './seated-presence.js';

const usersWith = (names: Record<string, string>): Pick<UserStore, 'namesOf'> => ({
  namesOf: async (ids) => {
    const found = ids.flatMap((id) => {
      const name = names[id];
      return name === undefined ? [] : [[id, name] as const];
    });
    return new Map(found);
  },
});

describe('seatedPresence', () => {
  it('carries the id a profile link needs alongside the name', async () => {
    const presence = await seatedPresence(usersWith({ bob: 'Amber Beetle' }), 'bob', 'connected');

    expect(presence).toEqual({ status: 'connected', userId: 'bob', name: 'Amber Beetle' });
  });

  it('keeps the seat when the account behind it is gone', async () => {
    const presence = await seatedPresence(usersWith({}), 'bob', 'disconnected');

    expect(presence.status).toBe('disconnected');
    expect(presence.name).toBe('Deleted player');
  });
});
