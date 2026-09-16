import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BASE_RULESET, listValidMoves } from '@termitary/engine';
import { fromWire, toWireMove } from '@termitary/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { type DbHandle, createDb } from './adapters/db/client.js';
import { type TestApp, createTestApp } from './testing/auth-helper.js';
import { connect, expectKind } from './testing/ws-client.js';

const BASE_WIRE = { pieces: { ...BASE_RULESET.pieces } };

// Phase 4's goal: a game outlives the process that created it.
describe('room persistence across a restart', () => {
  let dir: string;
  let path: string;

  const boot = async (): Promise<{ db: DbHandle; ctx: TestApp; wsUrl: string }> => {
    const db = createDb(path);
    const ctx = await createTestApp(db);
    const base = await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    return { db, ctx, wsUrl: `${base.replace('http://', 'ws://')}/ws` };
  };

  const shutdown = async (started: { db: DbHandle; ctx: TestApp }): Promise<void> => {
    await started.ctx.app.close();
    started.db.close();
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'termitary-persistence-'));
    path = join(dir, 'test.db');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('resumes a played game after the process is replaced', async () => {
    const first = await boot();
    let roomId: string;
    let played: ReturnType<typeof toWireMove>;
    let cookie: string;
    let userId: string;

    try {
      const alice = await first.ctx.signIn('alice@example.test');
      cookie = alice.cookie;
      userId = alice.userId;

      const created = await first.ctx.app.inject({
        method: 'POST',
        url: '/rooms',
        payload: { seat: 'white' },
        headers: { cookie },
      });
      expect(created.statusCode).toBe(200);
      roomId = created.json<{ roomId: string }>().roomId;

      const ws = await connect(first.wsUrl, userId, cookie);
      expectKind(await ws.next(), 'connected');
      ws.send({ type: 'joinGame', roomId });
      const joined = expectKind(await ws.next((m) => m.type === 'gameJoined'), 'gameJoined');

      const opening = listValidMoves(fromWire(joined.state))[0];
      if (opening === undefined) throw new Error('no legal opening move');
      played = toWireMove(opening);
      ws.send({ type: 'makeMove', roomId, move: played });
      expectKind(await ws.next((m) => m.type === 'stateUpdated'), 'stateUpdated');
      await ws.close();
    } finally {
      await shutdown(first);
    }

    const second = await boot();
    try {
      // The session lives in the same file, so the old cookie still works.
      const listed = await second.ctx.app.inject({
        method: 'GET',
        url: '/rooms/mine',
        headers: { cookie },
      });
      expect(listed.statusCode).toBe(200);
      expect(listed.json()).toEqual([
        {
          roomId,
          seat: 'white',
          playerCount: 1,
          updatedAt: expect.any(Number),
          ruleset: BASE_WIRE,
        },
      ]);

      // The board, not just the summary: the move made before the restart is
      // still in the state the server hands back.
      const ws = await connect(second.wsUrl, userId, cookie);
      expectKind(await ws.next(), 'connected');
      ws.send({ type: 'joinGame', roomId });
      const rejoined = expectKind(await ws.next((m) => m.type === 'gameJoined'), 'gameJoined');

      expect(rejoined.playerColor).toBe('white');
      expect(rejoined.state.history).toEqual([played]);
      expect(fromWire(rejoined.state).board.cells.size).toBe(1);
      expect(rejoined.state.currentPlayer).toBe('black');
      await ws.close();
    } finally {
      await shutdown(second);
    }
  });
});
