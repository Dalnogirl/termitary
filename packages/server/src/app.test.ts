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

    it('the created room shows up in GET /rooms for everyone else', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const created = await ctx.app.inject({
        method: 'POST',
        url: '/rooms',
        headers: { cookie },
      });
      const { roomId } = created.json() as { roomId: string };

      const bob = await ctx.signIn('bob@test.dev');
      const listed = await ctx.app.inject({
        method: 'GET',
        url: '/rooms',
        headers: { cookie: bob.cookie },
      });
      expect(listed.statusCode).toBe(200);
      const rooms = listed.json() as Array<{ roomId: string; playerCount: number }>;
      expect(rooms.some((r) => r.roomId === roomId && r.playerCount === 1)).toBe(true);
    });

    it('the creator sees their own room under GET /rooms/mine, not GET /rooms', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const created = await ctx.app.inject({
        method: 'POST',
        url: '/rooms',
        headers: { cookie },
      });
      const { roomId } = created.json() as { roomId: string };

      const open = await ctx.app.inject({ method: 'GET', url: '/rooms', headers: { cookie } });
      expect((open.json() as Array<{ roomId: string }>).map((r) => r.roomId)).not.toContain(roomId);

      const mine = await ctx.app.inject({ method: 'GET', url: '/rooms/mine', headers: { cookie } });
      expect(mine.statusCode).toBe(200);
      expect(mine.json()).toEqual([
        { roomId, seat: 'white', playerCount: 1, updatedAt: expect.any(Number) },
      ]);
    });
  });

  describe('DELETE /rooms/:id', () => {
    const createRoom = async (cookie: string): Promise<string> => {
      const res = await ctx.app.inject({ method: 'POST', url: '/rooms', headers: { cookie } });
      return (res.json() as { roomId: string }).roomId;
    };

    it('cancels a room the caller is alone in', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const roomId = await createRoom(cookie);

      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/rooms/${roomId}`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(204);

      const mine = await ctx.app.inject({ method: 'GET', url: '/rooms/mine', headers: { cookie } });
      expect(mine.json()).toEqual([]);
    });

    it('returns 403 for someone with no seat in the room', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const roomId = await createRoom(cookie);
      const eve = await ctx.signIn('eve@test.dev');

      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/rooms/${roomId}`,
        headers: { cookie: eve.cookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 404 for an unknown room and 401 without an auth cookie', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const missing = await ctx.app.inject({
        method: 'DELETE',
        url: '/rooms/nope',
        headers: { cookie },
      });
      expect(missing.statusCode).toBe(404);

      const anon = await ctx.app.inject({ method: 'DELETE', url: '/rooms/nope' });
      expect(anon.statusCode).toBe(401);
    });
  });

  describe('GET /rooms', () => {
    it('returns 401 without an auth cookie', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/rooms' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /rooms/mine', () => {
    it('returns 401 without an auth cookie', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/rooms/mine' });
      expect(res.statusCode).toBe(401);
    });

    it('is empty for a player seated nowhere', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      await ctx.app.inject({ method: 'POST', url: '/rooms', headers: { cookie } });

      const bob = await ctx.signIn('bob@test.dev');
      const mine = await ctx.app.inject({
        method: 'GET',
        url: '/rooms/mine',
        headers: { cookie: bob.cookie },
      });
      expect(mine.json()).toEqual([]);
    });
  });
});
