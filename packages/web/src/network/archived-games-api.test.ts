import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchArchivedGame, fetchArchivedGames } from './archived-games-api.js';

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

describe('fetchArchivedGames', () => {
  it('sends the cookie and no cursor on the first page', async () => {
    const fake = respond(200, { items: [] });
    await fetchArchivedGames();
    expect(fake).toHaveBeenCalledWith(expect.stringMatching(/\/archived-games$/), {
      credentials: 'include',
    });
  });

  it('hands the cursor back encoded', async () => {
    const fake = respond(200, { items: [] });
    await fetchArchivedGames('a+b/c=');
    expect(fake).toHaveBeenCalledWith(
      expect.stringContaining('?before=a%2Bb%2Fc%3D'),
      expect.anything(),
    );
  });

  it('throws on a failed page', async () => {
    respond(500, {});
    await expect(fetchArchivedGames()).rejects.toThrow('500');
  });
});

describe('fetchArchivedGame', () => {
  it('reads a 404 as nothing to show rather than an error', async () => {
    respond(404, { error: 'not-found' });
    await expect(fetchArchivedGame('g1')).resolves.toBeNull();
  });

  it('still throws on any other failure', async () => {
    respond(500, {});
    await expect(fetchArchivedGame('g1')).rejects.toThrow('500');
  });
});
