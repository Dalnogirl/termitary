import { type GameState, listValidMoves, replayFrames } from '@termitary/engine';
import { SURROUND_GAME } from '@termitary/engine/testing';
import {
  type ArchivedGameDetailDto,
  type MyRoomSummaryDto,
  type PostSeekResponseDto,
  fromWire,
  toWireMove,
} from '@termitary/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { type TestApp, createTestApp } from '../testing/auth-helper.js';
import { type TestClient, connect, expectKind } from '../testing/ws-client.js';

type Player = { userId: string; cookie: string };

describe('ws integration', () => {
  let ctx: TestApp;
  let baseUrl: string;
  let wsUrl: string;
  let alice: Player;
  let bob: Player;

  // The generated name, read back the way the web client reads it.
  const nameOf = async ({
    userId,
    cookie,
  }: { userId: string; cookie: string }): Promise<string> => {
    const res = await ctx.app.inject({
      method: 'GET',
      url: `/api/users/${userId}`,
      headers: { cookie },
    });
    return (res.json() as { name: string }).name;
  };

  // Seats are a coin flip, so each test learns who it is driving as white.
  const pair = async (): Promise<{ roomId: string; white: Player; black: Player }> => {
    const seek = (cookie: string) =>
      ctx.app.inject({ method: 'POST', url: '/api/seeks', payload: {}, headers: { cookie } });
    await seek(alice.cookie);
    const paired = (await seek(bob.cookie)).json() as PostSeekResponseDto;
    if (paired.outcome !== 'paired') throw new Error(`expected a pairing, got ${paired.outcome}`);

    const mine = await ctx.app.inject({
      method: 'GET',
      url: '/api/rooms/mine',
      headers: { cookie: alice.cookie },
    });
    const [room] = mine.json() as MyRoomSummaryDto[];
    const [white, black] = room?.seat === 'white' ? [alice, bob] : [bob, alice];
    return { roomId: paired.roomId, white, black };
  };

  beforeEach(async () => {
    ctx = await createTestApp();
    baseUrl = await ctx.app.listen({ port: 0, host: '127.0.0.1' });
    wsUrl = `${baseUrl.replace('http://', 'ws://')}/ws`;
    alice = await ctx.signIn('alice@test.dev');
    bob = await ctx.signIn('bob@test.dev');
  });

  afterEach(async () => {
    await ctx.app.close();
    ctx.db.close();
  });

  it('drives a full pair → join → move → resign flow between two clients', async () => {
    // Pair over REST, the way the real client does (no WS until the join).
    const { roomId, white, black } = await pair();

    const whiteWs = await connect(wsUrl, white.userId, white.cookie);
    const blackWs = await connect(wsUrl, black.userId, black.cookie);

    expectKind(await whiteWs.next(), 'connected');
    expectKind(await blackWs.next(), 'connected');

    whiteWs.send({ type: 'joinGame', roomId });
    const whiteJoined = expectKind(
      await whiteWs.next((m) => m.type === 'gameJoined'),
      'gameJoined',
    );
    expect(whiteJoined.playerColor).toBe('white');
    expect(whiteJoined.roomId).toBe(roomId);

    blackWs.send({ type: 'joinGame', roomId });
    const blackJoined = expectKind(
      await blackWs.next((m) => m.type === 'gameJoined'),
      'gameJoined',
    );
    expect(blackJoined.playerColor).toBe('black');
    expect(blackJoined.roomId).toBe(roomId);

    const whiteSawBlack = expectKind(
      await whiteWs.next((m) => m.type === 'presenceUpdate'),
      'presenceUpdate',
    );
    expect(whiteSawBlack.opponent.status).toBe('connected');

    const firstMove = listValidMoves(fromWire(whiteJoined.state))[0];
    if (!firstMove) throw new Error('no valid first move');
    whiteWs.send({ type: 'makeMove', roomId, move: toWireMove(firstMove) });

    const whiteAfterMove = expectKind(
      await whiteWs.next((m) => m.type === 'stateUpdated'),
      'stateUpdated',
    );
    const blackAfterMove = expectKind(
      await blackWs.next((m) => m.type === 'stateUpdated'),
      'stateUpdated',
    );
    expect(fromWire(whiteAfterMove.state).currentPlayer).toBe('black');
    expect(fromWire(blackAfterMove.state).history.length).toBe(1);

    whiteWs.send({ type: 'resign', roomId });
    for (const ws of [whiteWs, blackWs]) {
      const finished = expectKind(
        await ws.next((m) => m.type === 'stateUpdated' && m.state.status === 'finished'),
        'stateUpdated',
      );
      if (finished.state.status !== 'finished') throw new Error('unreachable');
      expect(finished.state.result).toBe('black-wins');
      expect(finished.state.endReason).toBe('resignation');
    }

    await whiteWs.close();
    await blackWs.close();
  });

  it('plays a scripted game to a surround and archives something that replays', async () => {
    const { roomId, white: whitePlayer, black: blackPlayer } = await pair();
    const white = await connect(wsUrl, whitePlayer.userId, whitePlayer.cookie);
    const black = await connect(wsUrl, blackPlayer.userId, blackPlayer.cookie);
    expectKind(await white.next(), 'connected');
    expectKind(await black.next(), 'connected');

    white.send({ type: 'joinGame', roomId });
    expectKind(await white.next((m) => m.type === 'gameJoined'), 'gameJoined');
    black.send({ type: 'joinGame', roomId });
    expectKind(await black.next((m) => m.type === 'gameJoined'), 'gameJoined');

    const lastSeen = new Map<TestClient, GameState>();
    for (const [index, move] of SURROUND_GAME.moves.entries()) {
      const mover = index % 2 === 0 ? white : black;
      mover.send({ type: 'makeMove', roomId, move: toWireMove(move) });
      for (const ws of [white, black]) {
        const update = expectKind(await ws.next((m) => m.type === 'stateUpdated'), 'stateUpdated');
        const state = fromWire(update.state);
        // One update per move, in order: a longer history here means a client
        // skipped a position rather than merely arrived at the right one.
        expect(state.history).toEqual(SURROUND_GAME.moves.slice(0, index + 1));
        lastSeen.set(ws, state);
      }
    }

    for (const ws of [white, black]) {
      const state = lastSeen.get(ws);
      if (state?.status !== 'finished') throw new Error('the last move left the game running');
      expect(state.result).toBe('white-wins');
      expect(state.endReason).toBe('queen-surrounded');
    }

    const archived = await ctx.app.inject({
      method: 'GET',
      url: `/api/archived-games/${roomId}`,
      headers: { cookie: whitePlayer.cookie },
    });
    expect(archived.statusCode).toBe(200);
    const state = fromWire((archived.json() as ArchivedGameDetailDto).state);
    const replayed = replayFrames(state.history, state.ruleset);
    expect(replayed.at(-1)?.board).toEqual(SURROUND_GAME.final.board);

    await white.close();
    await black.close();
  });

  it('answers a socket opened while the previous one for the same player is still closing', async () => {
    // React's StrictMode remount, and any reload, opens the replacement socket
    // before the old one's close lands on the server. Binding is per player, so
    // the late close used to unbind the live socket and every reply to it —
    // gameJoined included — went nowhere.
    const { roomId } = await pair();
    const aliceWs = await connect(wsUrl, alice.userId, alice.cookie);
    expectKind(await aliceWs.next(), 'connected');
    aliceWs.send({ type: 'joinGame', roomId });
    expectKind(await aliceWs.next((m) => m.type === 'gameJoined'), 'gameJoined');

    const abandoned = await connect(wsUrl, bob.userId, bob.cookie);
    void abandoned.close();
    const bobWs = await connect(wsUrl, bob.userId, bob.cookie);
    expectKind(await bobWs.next((m) => m.type === 'connected'), 'connected');

    bobWs.send({ type: 'joinGame', roomId });
    const joined = expectKind(await bobWs.next((m) => m.type === 'gameJoined'), 'gameJoined');
    expect(joined.opponent.status).toBe('connected');

    // The superseded close must not report bob as away either.
    aliceWs.send({ type: 'joinGame', roomId });
    const aliceRejoined = expectKind(
      await aliceWs.next((m) => m.type === 'gameJoined'),
      'gameJoined',
    );
    expect(aliceRejoined.opponent.status).toBe('connected');

    await aliceWs.close();
    await bobWs.close();
  });

  it('returns an error tagged with requestKind for moves on unknown rooms', async () => {
    const aliceWs = await connect(wsUrl, alice.userId, alice.cookie);
    expectKind(await aliceWs.next(), 'connected');
    aliceWs.send({ type: 'makeMove', roomId: 'nope', move: { kind: 'pass' } });
    const err = expectKind(await aliceWs.next((m) => m.type === 'error'), 'error');
    expect(err.requestKind).toBe('makeMove');
    expect(err.message).toBe('room not found');
    await aliceWs.close();
  });

  it('emits presenceUpdate connected to the opponent on re-attach', async () => {
    // Validates the lifecycle through the real WS stack: drop a socket,
    // reconnect with the same identity, and confirm the still-seated
    // opponent sees the connect transition. Unit-level coverage in
    // usecases.test.ts proves the message is sent; this proves it
    // survives socket teardown + identity round-trip.
    const { roomId } = await pair();
    const aliceWs = await connect(wsUrl, alice.userId, alice.cookie);
    let bobWs = await connect(wsUrl, bob.userId, bob.cookie);
    expectKind(await aliceWs.next(), 'connected');
    expectKind(await bobWs.next(), 'connected');

    aliceWs.send({ type: 'joinGame', roomId });
    expectKind(await aliceWs.next((m) => m.type === 'gameJoined'), 'gameJoined');
    bobWs.send({ type: 'joinGame', roomId });
    expectKind(await bobWs.next((m) => m.type === 'gameJoined'), 'gameJoined');
    // Drain alice's view of bob's first connect.
    expectKind(await aliceWs.next((m) => m.type === 'presenceUpdate'), 'presenceUpdate');

    await bobWs.close();
    // Drain the disconnect alice now sees.
    expectKind(await aliceWs.next((m) => m.type === 'presenceUpdate'), 'presenceUpdate');

    bobWs = await connect(wsUrl, bob.userId, bob.cookie);
    expectKind(await bobWs.next(), 'connected');
    bobWs.send({ type: 'joinGame', roomId });
    expectKind(await bobWs.next((m) => m.type === 'gameJoined'), 'gameJoined');

    const reconnect = expectKind(
      await aliceWs.next((m) => m.type === 'presenceUpdate'),
      'presenceUpdate',
    );
    expect(reconnect.opponent).toEqual({
      status: 'connected',
      userId: bob.userId,
      name: await nameOf(bob),
    });

    await aliceWs.close();
    await bobWs.close();
  });

  it('emits presenceUpdate disconnected to the opponent when a socket closes', async () => {
    const { roomId } = await pair();
    const aliceWs = await connect(wsUrl, alice.userId, alice.cookie);
    const bobWs = await connect(wsUrl, bob.userId, bob.cookie);
    expectKind(await aliceWs.next(), 'connected');
    expectKind(await bobWs.next(), 'connected');

    aliceWs.send({ type: 'joinGame', roomId });
    expectKind(await aliceWs.next((m) => m.type === 'gameJoined'), 'gameJoined');

    bobWs.send({ type: 'joinGame', roomId });
    expectKind(await bobWs.next((m) => m.type === 'gameJoined'), 'gameJoined');
    const aliceSawBobConnect = expectKind(
      await aliceWs.next((m) => m.type === 'presenceUpdate'),
      'presenceUpdate',
    );
    expect(aliceSawBobConnect.opponent.status).toBe('connected');

    await bobWs.close();
    const aliceSawBobDisconnect = expectKind(
      await aliceWs.next((m) => m.type === 'presenceUpdate'),
      'presenceUpdate',
    );
    // The name rides on the event, so a client that never saw bob connect
    // still has someone to show next to the disconnected state.
    expect(aliceSawBobDisconnect.opponent).toEqual({
      status: 'disconnected',
      userId: bob.userId,
      name: await nameOf(bob),
    });
    expect(aliceSawBobDisconnect.roomId).toBe(roomId);

    await aliceWs.close();
  });

  it('rejects WS upgrade without an auth cookie with 401', async () => {
    const ws = new WebSocket(wsUrl);
    const err = await new Promise<Error>((resolve, reject) => {
      ws.once('open', () => reject(new Error('expected upgrade to fail')));
      ws.once('error', (e) => resolve(e));
    });
    expect(String(err)).toMatch(/401/);
  });
});
