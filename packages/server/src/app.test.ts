import { BASE_RULESET, rulesetFor } from '@termitary/engine';
import type {
  ArchivedGameDetailDto,
  ArchivedGameSummaryDto,
  MyRoomSummaryDto,
  Page,
  PostSeekRequestDto,
  PostSeekResponseDto,
  ProfileDto,
  SeekBoardDto,
} from '@termitary/protocol';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { seeks as seeksTable } from './adapters/db/schema.js';
import { createDrizzleArchivedGameStore } from './adapters/drizzle-archived-game-store.js';
import { toArchivedGame } from './domain/archived-game.js';
import { isFinished, createRoom as newRoom, seatPlayer, touch } from './domain/room.js';
import { type TestApp, createTestApp } from './testing/auth-helper.js';

const BASE_WIRE = { pieces: { ...BASE_RULESET.pieces } };

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
        url: '/api/rooms',
        payload: { seat: 'white' },
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { roomId: string };
      expect(body.roomId).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('returns 401 without an auth cookie', async () => {
      const res = await ctx.app.inject({ method: 'POST', url: '/api/rooms' });
      expect(res.statusCode).toBe(401);
    });

    it('deals the expansion pieces the body asked for, to both hands', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const ladybug = { pieces: { ...BASE_RULESET.pieces, ladybug: 1 } };
      const created = await ctx.app.inject({
        method: 'POST',
        url: '/api/rooms',
        payload: { seat: 'white', ruleset: ladybug },
        headers: { cookie },
      });
      expect(created.statusCode).toBe(200);
      const { roomId } = created.json() as { roomId: string };

      const mine = await ctx.app.inject({
        method: 'GET',
        url: '/api/rooms/mine',
        headers: { cookie },
      });
      expect(mine.json()).toEqual([
        { roomId, seat: 'white', playerCount: 1, updatedAt: expect.any(Number), ruleset: ladybug },
      ]);
    });

    it('rejects a piece type it does not know rather than creating the room', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/rooms',
        payload: { seat: 'white', ruleset: { pieces: { ...BASE_RULESET.pieces, wasp: 1 } } },
        headers: { cookie },
      });
      expect(res.statusCode).toBe(400);

      const mine = await ctx.app.inject({
        method: 'GET',
        url: '/api/rooms/mine',
        headers: { cookie },
      });
      expect(mine.json()).toEqual([]);
    });

    it('rejects a queenless ruleset, which parses but cannot be played', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/rooms',
        payload: { seat: 'white', ruleset: { pieces: { ant: 3 } } },
        headers: { cookie },
      });
      expect(res.statusCode).toBe(400);
      expect(res.json()).toEqual({ error: 'invalid-ruleset' });
    });

    it('seats the creator black and leaves white free', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const created = await ctx.app.inject({
        method: 'POST',
        url: '/api/rooms',
        payload: { seat: 'black' },
        headers: { cookie },
      });
      expect(created.statusCode).toBe(200);
      const { roomId } = created.json() as { roomId: string };

      const mine = await ctx.app.inject({
        method: 'GET',
        url: '/api/rooms/mine',
        headers: { cookie },
      });
      expect(mine.json()).toEqual([
        {
          roomId,
          seat: 'black',
          playerCount: 1,
          updatedAt: expect.any(Number),
          ruleset: BASE_WIRE,
        },
      ]);
    });

    it('resolves `random` to one of the two seats', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const created = await ctx.app.inject({
        method: 'POST',
        url: '/api/rooms',
        payload: { seat: 'random' },
        headers: { cookie },
      });
      expect(created.statusCode).toBe(200);

      const mine = await ctx.app.inject({
        method: 'GET',
        url: '/api/rooms/mine',
        headers: { cookie },
      });
      const [room] = mine.json() as Array<{ seat: string }>;
      expect(['white', 'black']).toContain(room?.seat);
    });

    it('rejects a missing body and a seat the schema does not know', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      for (const payload of [undefined, {}, { seat: 'green' }, { seat: null }]) {
        const res = await ctx.app.inject({
          method: 'POST',
          url: '/api/rooms',
          ...(payload === undefined ? {} : { payload }),
          headers: { cookie },
        });
        expect(res.statusCode).toBe(400);
      }

      const mine = await ctx.app.inject({
        method: 'GET',
        url: '/api/rooms/mine',
        headers: { cookie },
      });
      expect(mine.json()).toEqual([]);
    });

    it('the created room shows up in GET /rooms for everyone else', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const created = await ctx.app.inject({
        method: 'POST',
        url: '/api/rooms',
        payload: { seat: 'white' },
        headers: { cookie },
      });
      const { roomId } = created.json() as { roomId: string };

      const bob = await ctx.signIn('bob@test.dev');
      const listed = await ctx.app.inject({
        method: 'GET',
        url: '/api/rooms',
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
        url: '/api/rooms',
        payload: { seat: 'white' },
        headers: { cookie },
      });
      const { roomId } = created.json() as { roomId: string };

      const open = await ctx.app.inject({ method: 'GET', url: '/api/rooms', headers: { cookie } });
      expect((open.json() as Array<{ roomId: string }>).map((r) => r.roomId)).not.toContain(roomId);

      const mine = await ctx.app.inject({
        method: 'GET',
        url: '/api/rooms/mine',
        headers: { cookie },
      });
      expect(mine.statusCode).toBe(200);
      expect(mine.json()).toEqual([
        {
          roomId,
          seat: 'white',
          playerCount: 1,
          updatedAt: expect.any(Number),
          ruleset: BASE_WIRE,
        },
      ]);
    });
  });

  describe('DELETE /rooms/:id', () => {
    const createRoom = async (cookie: string): Promise<string> => {
      const res = await ctx.app.inject({
        method: 'POST',
        url: '/api/rooms',
        payload: { seat: 'white' },
        headers: { cookie },
      });
      return (res.json() as { roomId: string }).roomId;
    };

    it('cancels a room the caller is alone in', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const roomId = await createRoom(cookie);

      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/rooms/${roomId}`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(204);

      const mine = await ctx.app.inject({
        method: 'GET',
        url: '/api/rooms/mine',
        headers: { cookie },
      });
      expect(mine.json()).toEqual([]);
    });

    it('returns 403 for someone with no seat in the room', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const roomId = await createRoom(cookie);
      const eve = await ctx.signIn('eve@test.dev');

      const res = await ctx.app.inject({
        method: 'DELETE',
        url: `/api/rooms/${roomId}`,
        headers: { cookie: eve.cookie },
      });
      expect(res.statusCode).toBe(403);
    });

    it('returns 404 for an unknown room and 401 without an auth cookie', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      const missing = await ctx.app.inject({
        method: 'DELETE',
        url: '/api/rooms/nope',
        headers: { cookie },
      });
      expect(missing.statusCode).toBe(404);

      const anon = await ctx.app.inject({ method: 'DELETE', url: '/api/rooms/nope' });
      expect(anon.statusCode).toBe(401);
    });
  });

  describe('GET /rooms', () => {
    it('returns 401 without an auth cookie', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/rooms' });
      expect(res.statusCode).toBe(401);
    });
  });

  describe('GET /rooms/mine', () => {
    it('returns 401 without an auth cookie', async () => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/rooms/mine' });
      expect(res.statusCode).toBe(401);
    });

    it('is empty for a player seated nowhere', async () => {
      const { cookie } = await ctx.signIn('alice@test.dev');
      await ctx.app.inject({
        method: 'POST',
        url: '/api/rooms',
        payload: { seat: 'white' },
        headers: { cookie },
      });

      const bob = await ctx.signIn('bob@test.dev');
      const mine = await ctx.app.inject({
        method: 'GET',
        url: '/api/rooms/mine',
        headers: { cookie: bob.cookie },
      });
      expect(mine.json()).toEqual([]);
    });
  });

  describe('archives and profiles', () => {
    // Reaching a finished game through the socket would test the write path
    // over again; these routes only care that a row exists.
    const archiveGame = async (
      id: string,
      seats: { white: { id: string; name: string }; black: { id: string; name: string } },
      finishedAt: number,
      over: {
        result?: 'white-wins' | 'black-wins' | 'draw';
        endReason?: 'queen-surrounded' | 'resignation';
      } = {},
    ): Promise<void> => {
      const seated = seatPlayer(
        newRoom(id, { playerId: seats.white.id }, 'white', new Date(1000)),
        {
          playerId: seats.black.id,
        },
      );
      const room = touch(
        {
          ...seated,
          state: {
            ...seated.state,
            status: 'finished',
            result: over.result ?? 'white-wins',
            endReason: over.endReason ?? 'resignation',
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

    const listed = async (
      cookie: string,
      userId: string,
      query = '',
    ): Promise<Page<ArchivedGameSummaryDto>> => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/users/${userId}/games${query}`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      return res.json() as Page<ArchivedGameSummaryDto>;
    };

    const profileOf = async (cookie: string, userId: string): Promise<ProfileDto> => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: `/api/users/${userId}`,
        headers: { cookie },
      });
      expect(res.statusCode).toBe(200);
      return res.json() as ProfileDto;
    };

    const twoPlayers = async () => {
      const alice = await ctx.signIn('alice@test.dev');
      const bob = await ctx.signIn('bob@test.dev');
      return {
        alice: { ...alice, id: alice.userId, name: 'Alice' },
        bob: { ...bob, id: bob.userId, name: 'Bob' },
      };
    };

    describe('GET /users/:userId/games', () => {
      it('returns 401 without an auth cookie', async () => {
        const res = await ctx.app.inject({ method: 'GET', url: '/api/users/someone/games' });
        expect(res.statusCode).toBe(401);
      });

      it('lists the named player\u2019s games, newest first, with their seat', async () => {
        const { alice, bob } = await twoPlayers();
        await archiveGame('older', { white: alice, black: bob }, 2000);
        await archiveGame('newer', { white: bob, black: alice }, 5000);

        expect(await listed(alice.cookie, alice.id)).toEqual({
          items: [
            {
              gameId: 'newer',
              seat: 'black',
              players: {
                white: { userId: bob.id, name: 'Bob' },
                black: { userId: alice.id, name: 'Alice' },
              },
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

      it('serves another player\u2019s games, seated from their side', async () => {
        const { alice, bob } = await twoPlayers();
        const eve = await ctx.signIn('eve@test.dev');
        await archiveGame('r1', { white: alice, black: bob }, 2000);

        expect((await listed(eve.cookie, bob.id)).items).toEqual([
          expect.objectContaining({ gameId: 'r1', seat: 'black' }),
        ]);
      });

      it('leaves out a game the named player never played', async () => {
        const { alice, bob } = await twoPlayers();
        const eve = await ctx.signIn('eve@test.dev');
        await archiveGame('theirs', { white: alice, black: bob }, 2000);

        expect(await listed(eve.cookie, eve.userId)).toEqual({ items: [] });
      });

      it('pages on the cursor and stops without one', async () => {
        const { alice, bob } = await twoPlayers();
        await archiveGame('r1', { white: alice, black: bob }, 1000);
        await archiveGame('r2', { white: alice, black: bob }, 2000);
        await archiveGame('r3', { white: alice, black: bob }, 3000);

        const first = await listed(alice.cookie, alice.id, '?limit=2');
        expect(first.items.map((g) => g.gameId)).toEqual(['r3', 'r2']);
        expect(first.nextCursor).toEqual(expect.any(String));

        const second = await listed(alice.cookie, alice.id, `?limit=2&before=${first.nextCursor}`);
        expect(second.items.map((g) => g.gameId)).toEqual(['r1']);
        expect(second.nextCursor).toBeUndefined();
      });

      it('omits the cursor when the last page is exactly full', async () => {
        const { alice, bob } = await twoPlayers();
        await archiveGame('r1', { white: alice, black: bob }, 1000);
        await archiveGame('r2', { white: alice, black: bob }, 2000);

        expect((await listed(alice.cookie, alice.id, '?limit=2')).nextCursor).toBeUndefined();
      });

      it('answers 400 to a cursor that does not decode', async () => {
        const { alice } = await twoPlayers();
        const res = await ctx.app.inject({
          method: 'GET',
          url: `/api/users/${alice.id}/games?before=not-a-cursor`,
          headers: { cookie: alice.cookie },
        });
        expect(res.statusCode).toBe(400);
      });

      it('answers 400 to a limit that is not a positive integer', async () => {
        const { alice } = await twoPlayers();
        const res = await ctx.app.inject({
          method: 'GET',
          url: `/api/users/${alice.id}/games?limit=0`,
          headers: { cookie: alice.cookie },
        });
        expect(res.statusCode).toBe(400);
      });

      it('caps an oversized limit instead of refusing it', async () => {
        const { alice, bob } = await twoPlayers();
        await archiveGame('r1', { white: alice, black: bob }, 1000);

        expect((await listed(alice.cookie, alice.id, '?limit=5000')).items).toHaveLength(1);
      });
    });

    describe('GET /users/:userId', () => {
      it('returns 401 without an auth cookie', async () => {
        const res = await ctx.app.inject({ method: 'GET', url: '/api/users/someone' });
        expect(res.statusCode).toBe(401);
      });

      it('answers 404 for an account that does not exist', async () => {
        const { alice } = await twoPlayers();
        const res = await ctx.app.inject({
          method: 'GET',
          url: '/api/users/nobody',
          headers: { cookie: alice.cookie },
        });
        expect(res.statusCode).toBe(404);
      });

      it('answers zeroes for a player who has finished nothing', async () => {
        const { alice } = await twoPlayers();

        const profile = await profileOf(alice.cookie, alice.id);
        expect(profile).toMatchObject({
          userId: alice.id,
          name: expect.any(String),
          memberSince: expect.any(Number),
        });
        expect(profile.record.overall).toEqual({
          played: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          winRate: 0,
        });
        expect(profile.record.lastPlayedAt).toBeNull();
      });

      it('counts a game once for a player who has held both seats', async () => {
        const { alice, bob } = await twoPlayers();
        await archiveGame('r1', { white: alice, black: bob }, 2000, { result: 'white-wins' });
        await archiveGame('r2', { white: bob, black: alice }, 3000, { result: 'black-wins' });

        const record = (await profileOf(bob.cookie, alice.id)).record;
        expect(record.overall).toMatchObject({ played: 2, wins: 2, losses: 0 });
        expect(record.asWhite).toMatchObject({ played: 1, wins: 1 });
        expect(record.asBlack).toMatchObject({ played: 1, wins: 1 });
        expect(record.longestWinStreak).toBe(2);
        expect(record.lastPlayedAt).toBe(3000);
      });

      it('counts a double queen surround as a draw for both players', async () => {
        const { alice, bob } = await twoPlayers();
        await archiveGame('r1', { white: alice, black: bob }, 2000, {
          result: 'draw',
          endReason: 'queen-surrounded',
        });

        for (const player of [alice, bob]) {
          const record = (await profileOf(alice.cookie, player.id)).record;
          expect(record.overall).toMatchObject({ played: 1, wins: 0, losses: 0, draws: 1 });
          expect(record.endings).toEqual({ queenSurrounded: 1, resignation: 0 });
        }
      });
    });

    describe('PATCH /profile', () => {
      const patchName = async (cookie: string, name: unknown) =>
        ctx.app.inject({
          method: 'PATCH',
          url: '/api/profile',
          headers: { cookie },
          payload: { name },
        });

      it('returns 401 without an auth cookie', async () => {
        const res = await ctx.app.inject({ method: 'PATCH', url: '/api/profile', payload: {} });
        expect(res.statusCode).toBe(401);
      });

      it('renames the caller and answers with the whole profile', async () => {
        const { alice } = await twoPlayers();

        const res = await patchName(alice.cookie, '  Ada   Lovelace ');
        expect(res.statusCode).toBe(200);
        expect(res.json() as ProfileDto).toMatchObject({
          userId: alice.id,
          name: 'Ada Lovelace',
          record: { overall: { played: 0 } },
        });
        expect((await profileOf(alice.cookie, alice.id)).name).toBe('Ada Lovelace');
      });

      it('rejects a name the schema refuses, with the message the form shows', async () => {
        const { alice } = await twoPlayers();
        const before = await profileOf(alice.cookie, alice.id);

        const res = await patchName(alice.cookie, 'a');
        expect(res.statusCode).toBe(400);
        expect((res.json() as { error: string }).error).toMatch(/characters/);
        expect((await profileOf(alice.cookie, alice.id)).name).toBe(before.name);
      });

      it('leaves the name an archived game snapshotted', async () => {
        const { alice, bob } = await twoPlayers();
        await archiveGame('r1', { white: alice, black: bob }, 2000);

        expect((await patchName(alice.cookie, 'Renamed')).statusCode).toBe(200);
        const page = await listed(alice.cookie, alice.id);
        expect(page.items[0]?.players.white).toEqual({ userId: alice.id, name: 'Alice' });
      });
    });

    describe('GET /archived-games/:id', () => {
      it('returns the game with the state a replay needs', async () => {
        const { alice, bob } = await twoPlayers();
        await archiveGame('r1', { white: alice, black: bob }, 4000);

        const res = await ctx.app.inject({
          method: 'GET',
          url: '/api/archived-games/r1',
          headers: { cookie: bob.cookie },
        });
        expect(res.statusCode).toBe(200);
        const game = res.json() as ArchivedGameDetailDto;
        expect(game).toMatchObject({
          gameId: 'r1',
          seat: 'black',
          players: {
            white: { userId: alice.id, name: 'Alice' },
            black: { userId: bob.id, name: 'Bob' },
          },
          finishedAt: 4000,
        });
        expect(game.state.history).toEqual([]);
      });

      it('opens a game the caller never played, seated from white', async () => {
        const { alice, bob } = await twoPlayers();
        const eve = await ctx.signIn('eve@test.dev');
        await archiveGame('r1', { white: alice, black: bob }, 4000);

        const res = await ctx.app.inject({
          method: 'GET',
          url: '/api/archived-games/r1',
          headers: { cookie: eve.cookie },
        });
        expect(res.statusCode).toBe(200);
        expect(res.json()).toMatchObject({ gameId: 'r1', seat: 'white' });
      });

      it('answers 404 to a game that does not exist', async () => {
        const { alice } = await twoPlayers();
        const res = await ctx.app.inject({
          method: 'GET',
          url: '/api/archived-games/nope',
          headers: { cookie: alice.cookie },
        });
        expect(res.statusCode).toBe(404);
      });

      it('returns 401 without an auth cookie', async () => {
        const res = await ctx.app.inject({ method: 'GET', url: '/api/archived-games/r1' });
        expect(res.statusCode).toBe(401);
      });
    });
  });

  describe('seek routes', () => {
    const postSeek = (cookie: string, payload?: PostSeekRequestDto) =>
      ctx.app.inject({
        method: 'POST',
        url: '/api/seeks',
        headers: { cookie },
        payload: payload ?? {},
      });

    const board = async (cookie: string) => {
      const res = await ctx.app.inject({ method: 'GET', url: '/api/seeks', headers: { cookie } });
      expect(res.statusCode).toBe(200);
      return res.json() as SeekBoardDto;
    };

    const myRooms = async (cookie: string) => {
      const res = await ctx.app.inject({
        method: 'GET',
        url: '/api/rooms/mine',
        headers: { cookie },
      });
      return res.json() as MyRoomSummaryDto[];
    };

    describe('POST /seeks', () => {
      it('stands a seek on the board when nothing fits', async () => {
        const { cookie } = await ctx.signIn('alice@test.dev');
        const res = await postSeek(cookie);

        expect(res.statusCode).toBe(200);
        const body = res.json() as PostSeekResponseDto;
        expect(body.outcome).toBe('waiting');
        expect((await board(cookie)).mine).not.toBeNull();
      });

      it('takes `{}` as the default seek, which is the Play button payload', async () => {
        const { cookie } = await ctx.signIn('alice@test.dev');
        const res = await postSeek(cookie, {});

        expect(res.statusCode).toBe(200);
        expect((await board(cookie)).mine?.preference).toEqual({});
      });

      // A body is required, as it is on /api/rooms. Fastify refuses an empty
      // one before the handler runs, so a route that read it as a default
      // would never get the chance.
      it('refuses a post with no body at all', async () => {
        const { cookie } = await ctx.signIn('alice@test.dev');
        for (const headers of [{ cookie }, { cookie, 'content-type': 'application/json' }]) {
          const res = await ctx.app.inject({ method: 'POST', url: '/api/seeks', headers });
          expect(res.statusCode).toBe(400);
        }
        expect((await board(cookie)).mine).toBeNull();
      });

      it('pairs the second player and seats them both', async () => {
        const alice = await ctx.signIn('alice@test.dev');
        const bob = await ctx.signIn('bob@test.dev');
        await postSeek(alice.cookie);

        const body = (await postSeek(bob.cookie)).json() as PostSeekResponseDto;

        expect(body.outcome).toBe('paired');
        const roomId = body.outcome === 'paired' ? body.roomId : '';
        expect((await myRooms(alice.cookie)).map((room) => room.roomId)).toEqual([roomId]);
        expect((await myRooms(bob.cookie)).map((room) => room.roomId)).toEqual([roomId]);
        // The seek is spent, so the board both players see is empty again.
        expect(await board(alice.cookie)).toEqual({ mine: null, pool: [] });
      });

      it('gives the pair every piece either side required', async () => {
        const alice = await ctx.signIn('alice@test.dev');
        const bob = await ctx.signIn('bob@test.dev');
        await postSeek(alice.cookie, { preference: { pillbug: 'require' } });
        await postSeek(bob.cookie, { preference: { ladybug: 'require' } });

        expect((await myRooms(alice.cookie))[0]?.ruleset).toEqual(
          rulesetFor(['ladybug', 'pillbug']),
        );
      });

      it('leaves both waiting when the terms clash', async () => {
        const alice = await ctx.signIn('alice@test.dev');
        const bob = await ctx.signIn('bob@test.dev');
        await postSeek(alice.cookie, { preference: { pillbug: 'require' } });

        const body = (
          await postSeek(bob.cookie, { preference: { pillbug: 'exclude' } })
        ).json() as PostSeekResponseDto;

        expect(body.outcome).toBe('waiting');
        expect((await board(bob.cookie)).pool).toHaveLength(1);
      });

      it('pairs with one listed seek by id', async () => {
        const alice = await ctx.signIn('alice@test.dev');
        const bob = await ctx.signIn('bob@test.dev');
        await postSeek(alice.cookie, { preference: { pillbug: 'require' } });
        const [listed] = (await board(bob.cookie)).pool;

        const body = (
          await postSeek(bob.cookie, { seekId: listed?.seekId ?? '' })
        ).json() as PostSeekResponseDto;

        expect(body.outcome).toBe('paired');
        expect((await myRooms(bob.cookie))[0]?.ruleset).toEqual(rulesetFor(['pillbug']));
      });

      it('refuses your own seek', async () => {
        const { cookie } = await ctx.signIn('alice@test.dev');
        const body = (await postSeek(cookie)).json() as PostSeekResponseDto;
        const seekId = body.outcome === 'waiting' ? body.seek.seekId : '';

        const res = await postSeek(cookie, { seekId });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({ error: 'seek-own' });
      });

      it('refuses a seek someone else already took', async () => {
        const alice = await ctx.signIn('alice@test.dev');
        const bob = await ctx.signIn('bob@test.dev');
        const carol = await ctx.signIn('carol@test.dev');
        const posted = (await postSeek(alice.cookie)).json() as PostSeekResponseDto;
        const seekId = posted.outcome === 'waiting' ? posted.seek.seekId : '';
        await postSeek(bob.cookie, { seekId });

        const res = await postSeek(carol.cookie, { seekId });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({ error: 'seek-gone' });
      });

      it('refuses terms the taker will not play', async () => {
        const alice = await ctx.signIn('alice@test.dev');
        const bob = await ctx.signIn('bob@test.dev');
        const posted = (
          await postSeek(alice.cookie, { preference: { pillbug: 'require' } })
        ).json() as PostSeekResponseDto;
        const seekId = posted.outcome === 'waiting' ? posted.seek.seekId : '';

        const res = await postSeek(bob.cookie, {
          seekId,
          preference: { pillbug: 'exclude' },
        });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({ error: 'seek-incompatible' });
      });

      it('leaves one seek on the board however many times you post', async () => {
        const { cookie } = await ctx.signIn('alice@test.dev');
        for (const preference of [{ ladybug: 'require' }, { pillbug: 'require' }, {}] as const) {
          expect((await postSeek(cookie, { preference })).statusCode).toBe(200);
        }

        expect((await board(cookie)).mine?.preference).toEqual({});
      });

      it('rejects a preference the picker cannot produce', async () => {
        const { cookie } = await ctx.signIn('alice@test.dev');
        const res = await postSeek(cookie, {
          preference: { ladybug: 'maybe' },
        } as unknown as PostSeekRequestDto);

        expect(res.statusCode).toBe(400);
        expect(res.json()).toEqual({ error: 'invalid-body' });
      });

      it('returns 401 without an auth cookie', async () => {
        const res = await ctx.app.inject({ method: 'POST', url: '/api/seeks' });
        expect(res.statusCode).toBe(401);
      });
    });

    describe('GET /seeks', () => {
      it('splits your own seeks from the ones you can take', async () => {
        const alice = await ctx.signIn('alice@test.dev');
        const bob = await ctx.signIn('bob@test.dev');
        await postSeek(alice.cookie, { preference: { pillbug: 'require' } });
        await postSeek(bob.cookie, { preference: { pillbug: 'exclude' } });

        const seen = await board(alice.cookie);
        expect(seen.mine?.preference).toEqual({ pillbug: 'require' });
        expect(seen.pool.map((seek) => seek.preference)).toEqual([{ pillbug: 'exclude' }]);
      });

      it('returns 401 without an auth cookie', async () => {
        const res = await ctx.app.inject({ method: 'GET', url: '/api/seeks' });
        expect(res.statusCode).toBe(401);
      });
    });

    describe('DELETE /seeks/:id', () => {
      it('takes your seek off the board', async () => {
        const { cookie } = await ctx.signIn('alice@test.dev');
        const posted = (await postSeek(cookie)).json() as PostSeekResponseDto;
        const seekId = posted.outcome === 'waiting' ? posted.seek.seekId : '';

        const res = await ctx.app.inject({
          method: 'DELETE',
          url: `/api/seeks/${seekId}`,
          headers: { cookie },
        });

        expect(res.statusCode).toBe(204);
        expect((await board(cookie)).mine).toBeNull();
      });

      it('refuses to cancel a seek that is not yours', async () => {
        const alice = await ctx.signIn('alice@test.dev');
        const bob = await ctx.signIn('bob@test.dev');
        const posted = (await postSeek(alice.cookie)).json() as PostSeekResponseDto;
        const seekId = posted.outcome === 'waiting' ? posted.seek.seekId : '';

        const res = await ctx.app.inject({
          method: 'DELETE',
          url: `/api/seeks/${seekId}`,
          headers: { cookie: bob.cookie },
        });

        expect(res.statusCode).toBe(403);
        expect((await board(bob.cookie)).pool).toHaveLength(1);
      });

      it('answers 404 to a seek that does not exist', async () => {
        const { cookie } = await ctx.signIn('alice@test.dev');
        const res = await ctx.app.inject({
          method: 'DELETE',
          url: '/api/seeks/nope',
          headers: { cookie },
        });
        expect(res.statusCode).toBe(404);
      });

      it('returns 401 without an auth cookie', async () => {
        const res = await ctx.app.inject({ method: 'DELETE', url: '/api/seeks/nope' });
        expect(res.statusCode).toBe(401);
      });
    });

    // What a rollback to a server that predates an expansion leaves behind.
    // Every route has to answer rather than fault, because the owner cannot
    // see the row to cancel it and the taker did nothing wrong.
    describe('a stored preference nothing can parse', () => {
      const cornerCase = async () => {
        const alice = await ctx.signIn('alice@test.dev');
        const bob = await ctx.signIn('bob@test.dev');
        const posted = (await postSeek(alice.cookie)).json() as PostSeekResponseDto;
        const seekId = posted.outcome === 'waiting' ? posted.seek.seekId : '';
        ctx.db.db
          .update(seeksTable)
          .set({ preference: { ladybug: 'maybe' } as never })
          .where(eq(seeksTable.id, seekId))
          .run();
        return { alice, bob, seekId };
      };

      // The row still holds the unique index, so the owner has to be able to
      // post over a seek they cannot see.
      it('leaves the board empty and still lets its owner seek', async () => {
        const { alice } = await cornerCase();

        expect(await board(alice.cookie)).toEqual({ mine: null, pool: [] });
        expect((await postSeek(alice.cookie)).statusCode).toBe(200);
        expect((await board(alice.cookie)).mine).not.toBeNull();
      });

      it('answers a take with seek-gone instead of faulting', async () => {
        const { bob, seekId } = await cornerCase();

        const res = await postSeek(bob.cookie, { seekId });
        expect(res.statusCode).toBe(409);
        expect(res.json()).toEqual({ error: 'seek-gone' });
      });

      it('answers a cancel with 404 instead of faulting', async () => {
        const { alice, seekId } = await cornerCase();

        const res = await ctx.app.inject({
          method: 'DELETE',
          url: `/api/seeks/${seekId}`,
          headers: { cookie: alice.cookie },
        });
        expect(res.statusCode).toBe(404);
      });
    });
  });
});
