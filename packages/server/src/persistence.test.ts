import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDb } from './adapters/db/client.js';
import { createTestApp } from './testing/auth-helper.js';

// Phase 4's goal: a game outlives the process that created it.
describe('room persistence across a restart', () => {
  let dir: string;
  let path: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hive-persistence-'));
    path = join(dir, 'test.db');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves a room created by a previous process', async () => {
    const firstDb = createDb(path);
    const first = await createTestApp(firstDb);
    const { cookie } = await first.signIn('white@example.test');

    const created = await first.app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { cookie },
    });
    expect(created.statusCode).toBe(200);
    const { roomId } = created.json<{ roomId: string }>();

    await first.app.close();
    firstDb.close();

    const secondDb = createDb(path);
    const second = await createTestApp(secondDb);
    try {
      // The session lives in the same file, so the old cookie still works.
      const listed = await second.app.inject({ method: 'GET', url: '/rooms', headers: { cookie } });
      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toEqual([{ roomId, playerCount: 1, status: 'in_progress' }]);
    } finally {
      await second.app.close();
      secondDb.close();
    }
  });
});
