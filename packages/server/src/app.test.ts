import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('REST routes', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /rooms', () => {
    it('creates a room and returns a roomId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/rooms',
        payload: { playerId: 'alice' },
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { roomId: string };
      expect(body.roomId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('rejects an invalid body with 400', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/rooms',
        payload: { wrongField: 'oops' },
        headers: { 'content-type': 'application/json' },
      });
      expect(res.statusCode).toBe(400);
    });

    it('the created room shows up in GET /rooms', async () => {
      const created = await app.inject({
        method: 'POST',
        url: '/rooms',
        payload: { playerId: 'alice' },
        headers: { 'content-type': 'application/json' },
      });
      const { roomId } = created.json() as { roomId: string };

      const listed = await app.inject({ method: 'GET', url: '/rooms' });
      expect(listed.statusCode).toBe(200);
      const rooms = listed.json() as Array<{ roomId: string; playerCount: number }>;
      expect(rooms.some((r) => r.roomId === roomId && r.playerCount === 1)).toBe(true);
    });
  });
});
