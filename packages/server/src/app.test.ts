import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type TestApp, createTestApp } from './testing/auth-helper.js';

describe('REST routes', () => {
  let ctx: TestApp;

  beforeEach(async () => {
    ctx = await createTestApp();
  });

  afterEach(async () => {
    await ctx.app.close();
    ctx.db.close();
  });

  describe('POST /rooms', () => {
    it('creates a room and returns a roomId', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/rooms',
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { roomId: string };
      expect(body.roomId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('returns 401 without an auth cookie', async () => {
      const res = await ctx.app.inject({ method: 'POST', url: '/rooms' });
      expect(res.statusCode).toBe(401);
    });

    it('the created room shows up in GET /rooms', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const created = await ctx.app.inject({
        method: 'POST',
        url: '/rooms',
        headers: { cookie },
      });
      const { roomId } = created.json() as { roomId: string };

      const listed = await ctx.app.inject({ method: 'GET', url: '/rooms', headers: { cookie } });
      expect(listed.statusCode).toBe(200);
      const rooms = listed.json() as Array<{ roomId: string; playerCount: number }>;
      expect(rooms.some((r) => r.roomId === roomId && r.playerCount === 1)).toBe(true);
    });
  });

  describe('GET /rooms', () => {
    it('returns 401 without an auth cookie', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/rooms' });
      expect(res.statusCode).toBe(401);
    });
  });
});
