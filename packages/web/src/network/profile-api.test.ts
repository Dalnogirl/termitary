// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchProfile, updateProfileName } from './profile-api.js';

const respond = (status: number, body: unknown): typeof fetch => {
  const fake = vi.fn(async () =>
    Promise.resolve({ ok: status < 400, status, json: async () => Promise.resolve(body) }),
  );
  vi.stubGlobal('fetch', fake);
  return fake as unknown as typeof fetch;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('fetchProfile', () => {
  it('escapes the player id it is given', async () => {
    const fake = respond(200, { userId: 'a/b' });
    await fetchProfile('a/b');
    expect(fake).toHaveBeenCalledWith(expect.stringContaining('/users/a%2Fb'), {
      credentials: 'include',
    });
  });

  it('answers null for a player who does not exist', async () => {
    respond(404, { error: 'not-found' });
    expect(await fetchProfile('nobody')).toBeNull();
  });
});

describe('updateProfileName', () => {
  it('sends the name as a PATCH body', async () => {
    const fake = respond(200, { name: 'Ada' });
    await updateProfileName('Ada');
    expect(fake).toHaveBeenCalledWith(
      expect.stringMatching(/\/profile$/),
      expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Ada' }) }),
    );
  });

  it('throws the server’s rejection copy, not the status', async () => {
    respond(400, { error: 'Name must be 2 to 32 characters.' });
    await expect(updateProfileName('a')).rejects.toThrow('Name must be 2 to 32 characters.');
  });
});
