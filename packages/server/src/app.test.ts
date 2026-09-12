import type { ArchivedGameDetailDto, ArchivedGameSummaryDto, Page } from '@termitary/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDrizzleArchivedGameStore } from './adapters/drizzle-archived-game-store.js';
import { toArchivedGame } from './domain/archived-game.js';
import { isFinished, createRoom as newRoom, seatPlayer, touch } from './domain/room.js';
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

  describe('GET /archived-games', () => {
    // Reaching a finished game through the socket would test the write path
    // over again; these routes only care that a row exists.
    const archiveGame = async (
      id: string,
      seats: { white: { id: string; name: string }; black: { id: string; name: string } },
      finishedAt: number,
    ): Promise<void> => {
      const seated = seatPlayer(newRoom(id, { playerId: seats.white.id }, new Date(1000)), {
        playerId: seats.black.id,
      });
      const room = touch(
        {
          ...seated,
          state: {
            ...seated.state,
            status: 'finished',
            result: 'white-wins',
            endReason: 'resignation',
          },
        },
        new Date(finishedAt),
      );
      if (!isFinished(room)) throw new Error('unreachable: the room was just finished');
      await createDrizzleArchivedGameStore(ctx.db.db).record(
        toArchivedGame(
          room,
          new Map([
            [seats.white.id, seats.white.name],
            [seats.black.id, seats.black.name],
          ]),
        ),
      );
    };

    const listed = async (cookie: string, query = ''): Promise<Page<ArchivedGameSummaryDto>> => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/archived-games${query}`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      return res.json() as Page<ArchivedGameSummaryDto>;
    };

    const twoPlayers = async () => {
      const alice = await ctx.signIn('alice@test.dev');
      const bob = await ctx.signIn('bob@test.dev');
      return {
        alice: { ...alice, id: alice.userId, name: 'Alice' },
        bob: { ...bob, id: bob.userId, name: 'Bob' },
      };
    };

    it('returns 401 without an auth cookie', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/archived-games' });
      expect(res.statusCode).toBe(401);
    });

    it('lists the games the caller played, newest first, with their seat', async () => {
      const { alice, bob } = await twoPlayers();
      await archiveGame('older', { white: alice, black: bob }, 2000);
      await archiveGame('newer', { white: bob, black: alice }, 5000);

      expect(await listed(alice.cookie)).toEqual({
        items: [
          {
            gameId: 'newer',
            seat: 'black',
            players: { white: 'Bob', black: 'Alice' },
            result: 'white-wins',
            endReason: 'resignation',
            startedAt: 1000,
            finishedAt: 5000,
            moveCount: 0,
          },
          expect.objectContaining({ gameId: 'older', seat: 'white' }),
        ],
      });
    });

    it('leaves out a game the caller never played', async () => {
      const { alice, bob } = await twoPlayers();
      const eve = await ctx.signIn('eve@test.dev');
      await archiveGame('theirs', { white: alice, black: bob }, 2000);

      expect(await listed(eve.cookie)).toEqual({ items: [] });
    });

    it('pages on the cursor and stops without one', async () => {
      const { alice, bob } = await twoPlayers();
      await archiveGame('r1', { white: alice, black: bob }, 1000);
      await archiveGame('r2', { white: alice, black: bob }, 2000);
      await archiveGame('r3', { white: alice, black: bob }, 3000);

      const first = await listed(alice.cookie, '?limit=2');
      expect(first.items.map((g) => g.gameId)).toEqual(['r3', 'r2']);
      expect(first.nextCursor).toEqual(expect.any(String));

      const second = await listed(alice.cookie, `?limit=2&before=${first.nextCursor}`);
      expect(second.items.map((g) => g.gameId)).toEqual(['r1']);
      expect(second.nextCursor).toBeUndefined();
    });

    it('omits the cursor when the last page is exactly full', async () => {
      const { alice, bob } = await twoPlayers();
      await archiveGame('r1', { white: alice, black: bob }, 1000);
      await archiveGame('r2', { white: alice, black: bob }, 2000);

      expect((await listed(alice.cookie, '?limit=2')).nextCursor).toBeUndefined();
    });

    it('answers 400 to a cursor that does not decode', async () => {
      const { alice } = await twoPlayers();
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/archived-games?before=not-a-cursor',
        headers: { cookie: alice.cookie },
      });
      expect(res.statusCode).toBe(400);
    });

    it('answers 400 to a limit that is not a positive integer', async () => {
      const { alice } = await twoPlayers();
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/archived-games?limit=0',
        headers: { cookie: alice.cookie },
      });
      expect(res.statusCode).toBe(400);
    });

    it('caps an oversized limit instead of refusing it', async () => {
      const { alice, bob } = await twoPlayers();
      await archiveGame('r1', { white: alice, black: bob }, 1000);

      expect((await listed(alice.cookie, '?limit=5000')).items).toHaveLength(1);
    });

    describe('GET /archived-games/:id', () => {
      it('returns the game with the state a replay needs', async () => {
        const { alice, bob } = await twoPlayers();
        await archiveGame('r1', { white: alice, black: bob }, 4000);

        const res = await ctx.app.inject({
          method: 'GET',
          url: '/archived-games/r1',
          headers: { cookie: bob.cookie },
        });
        expect(res.statusCode).toBe(200);
        const game = res.json() as ArchivedGameDetailDto;
        expect(game).toMatchObject({
          gameId: 'r1',
          seat: 'black',
          players: { white: 'Alice', black: 'Bob' },
          finishedAt: 4000,
        });
        expect(game.state.history).toEqual([]);
      });

      it('answers 404 to a non-participant, the same as an unknown game', async () => {
        const { alice, bob } = await twoPlayers();
        const eve = await ctx.signIn('eve@test.dev');
        await archiveGame('r1', { white: alice, black: bob }, 4000);

        const theirs = await ctx.app.inject({
          method: 'GET',
          url: '/archived-games/r1',
          headers: { cookie: eve.cookie },
        });
        const missing = await ctx.app.inject({
          method: 'GET',
          url: '/archived-games/nope',
          headers: { cookie: eve.cookie },
        });
        expect([theirs.statusCode, missing.statusCode]).toEqual([404, 404]);
        expect(theirs.json()).toEqual(missing.json());
      });

      it('returns 401 without an auth cookie', async () => {
        const res = await ctx.app.inject({ method: 'GET', url: '/archived-games/r1' });
        expect(res.statusCode).toBe(401);
      });
    });
  });
});
