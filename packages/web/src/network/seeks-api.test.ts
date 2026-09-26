// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cancelSeek, claimSeek, seekGame } from './seeks-api.js';

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

describe('seekGame', () => {
  it('posts the preference and nothing else', async () => {
    const fake = respond(200, { outcome: 'paired', roomId: 'r1' });
    expect(await seekGame({ ladybug: 'require' })).toEqual({ outcome: 'paired', roomId: 'r1' });
    expect(fake).toHaveBeenCalledWith(
      expect.stringMatching(/\/seeks$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ preference: { ladybug: 'require' } }),
      }),
    );
  });
});

describe('claimSeek', () => {
  it('sends the seek id without a preference', async () => {
    const fake = respond(200, { outcome: 'paired', roomId: 'r1' });
    await claimSeek('s1');
    expect(fake).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ body: JSON.stringify({ seekId: 's1' }) }),
    );
  });

  it('throws copy for a seek someone else took', async () => {
    respond(409, { error: 'seek-gone' });
    await expect(claimSeek('s1')).rejects.toThrow('Someone else took that game first.');
  });
});

describe('cancelSeek', () => {
  it('tells a cancel that won from a seek that was already gone', async () => {
    respond(204, undefined);
    expect(await cancelSeek('s1')).toBe('cancelled');
    respond(404, undefined);
    expect(await cancelSeek('s1')).toBe('gone');
  });

  it('throws on a seek that is not yours', async () => {
    respond(403, undefined);
    await expect(cancelSeek('s1')).rejects.toThrow('DELETE /seeks/s1 returned 403');
  });
});
