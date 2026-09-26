import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createAuth } from './adapters/auth/better-auth.js';
import { createDb } from './adapters/db/client.js';
import { createDrizzleUserStore } from './adapters/drizzle-user-store.js';
import { buildApp } from './app.js';
import { silentLog } from './testing/stores.js';

const INDEX_HTML = '<!doctype html><title>termitary</title>';

describe('the built SPA', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const dist = mkdtempSync(join(tmpdir(), 'termitary-dist-'));
    writeFileSync(join(dist, 'index.html'), INDEX_HTML);
    const db = createDb(':memory:');
    const auth = createAuth(db.db, createDrizzleUserStore(db.db), silentLog, {
      sendOtp: async () => {},
    });
    app = await buildApp({ db, auth, webDist: dist });
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the bundle at the root', async () => {
    const res = await app.inject({ method: 'GET', url: '/' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(INDEX_HTML);
  });

  it('serves a deep link the server has no route for', async () => {
    const res = await app.inject({ method: 'GET', url: '/archived-games/whatever' });
    expect(res.statusCode).toBe(200);
    expect(res.body).toBe(INDEX_HTML);
  });

  // The collision that makes the /api prefix worth having: react-router and the
  // API both answer to /archived-games/:id, and only the prefix tells them apart.
  it('leaves an API 404 a JSON 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/nothing-here' });
    expect(res.statusCode).toBe(404);
    expect(res.json()).toEqual({ error: 'not-found' });
  });

  it('answers HEAD on a deep link the way it answers GET', async () => {
    const res = await app.inject({ method: 'HEAD', url: '/lobby' });
    expect(res.statusCode).toBe(200);
  });

  // A tab open across a redeploy asks for a chunk that is gone. A page in its
  // place is an HTML parse error; a 404 is the truth.
  it('404s a missing asset rather than serving the page', async () => {
    const res = await app.inject({ method: 'GET', url: '/assets/index-OLD.js' });
    expect(res.statusCode).toBe(404);
  });

  it('404s /api without a trailing slash', async () => {
    const res = await app.inject({ method: 'GET', url: '/api' });
    expect(res.statusCode).toBe(404);
  });

  it('does not answer a POST with a page', async () => {
    const res = await app.inject({ method: 'POST', url: '/not-a-route' });
    expect(res.statusCode).toBe(404);
  });

  it('still gates the API behind it', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/rooms/mine' });
    expect(res.statusCode).toBe(401);
  });
});
