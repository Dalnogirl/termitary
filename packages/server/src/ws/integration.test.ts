import { listValidMoves } from '@hive/engine';
import { type ServerMessage, fromWire, toWireMove } from '@hive/protocol';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { type TestApp, createTestApp } from '../testing/auth-helper.js';
import { connect, expectKind } from '../testing/ws-client.js';

describe('ws integration', () => {
  let ctx: TestApp;
  let baseUrl: string;
  let wsUrl: string;
  let alice: { userId: string; cookie: string };
  let bob: { userId: string; cookie: string };

  const createRoomViaRest = async (cookie: string): Promise<string> => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/rooms',
      headers: { cookie },
    });
    const body = res.json() as { roomId: string };
    return body.roomId;
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

  it('drives a full create → join → move → leave flow between two clients', async () => {
    // Create over REST, the way the real client does (no WS until the join).
    const roomId = await createRoomViaRest(alice.cookie);

    const aliceWs = await connect(wsUrl, alice.userId, alice.cookie);
    const bobWs = await connect(wsUrl, bob.userId, bob.cookie);

    expectKind(await aliceWs.next(), 'connected');
    expectKind(await bobWs.next(), 'connected');

    // Alice rejoins her own room — server's re-attach path sends gameJoined.
    aliceWs.send({ type: 'joinGame', roomId });
    const aliceJoined = expectKind(
      await aliceWs.next((m) => m.type === 'gameJoined'),
      'gameJoined',
    );
    expect(aliceJoined.playerColor).toBe('white');
    expect(aliceJoined.roomId).toBe(roomId);

    // Bob joins as the second seat (black).
    bobWs.send({ type: 'joinGame', roomId });
    const bobJoined = expectKind(await bobWs.next((m) => m.type === 'gameJoined'), 'gameJoined');
    expect(bobJoined.playerColor).toBe('black');
    expect(bobJoined.roomId).toBe(roomId);

    const aliceJoinUpdate = expectKind(
      await aliceWs.next((m) => m.type === 'stateUpdated'),
      'stateUpdated',
    );
    expect(aliceJoinUpdate.roomId).toBe(roomId);

    const firstMove = listValidMoves(fromWire(aliceJoined.state))[0];
    if (!firstMove) throw new Error('no valid first move');
    aliceWs.send({ type: 'makeMove', roomId, move: toWireMove(firstMove) });

    const aliceAfterMove = expectKind(
      await aliceWs.next((m) => m.type === 'stateUpdated'),
      'stateUpdated',
    );
    const bobAfterMove = expectKind(
      await bobWs.next((m) => m.type === 'stateUpdated'),
      'stateUpdated',
    );
    expect(fromWire(aliceAfterMove.state).currentPlayer).toBe('black');
    expect(fromWire(bobAfterMove.state).history.length).toBe(1);

    aliceWs.send({ type: 'leaveGame', roomId });
    const opponentLeft = expectKind(
      await bobWs.next((m) => m.type === 'error' && m.message === 'opponent left'),
      'error',
    );
    expect(opponentLeft.message).toBe('opponent left');

    await aliceWs.close();
    await bobWs.close();
  });

  it('answers a socket opened while the previous one for the same player is still closing', async () => {
    // React's StrictMode remount, and any reload, opens the replacement socket
    // before the old one's close lands on the server. Binding is per player, so
    // the late close used to unbind the live socket and every reply to it —
    // gameJoined included — went nowhere.
    const roomId = await createRoomViaRest(alice.cookie);
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
    expect(joined.playerColor).toBe('black');
    expect(joined.opponent).toBe('connected');

    // The superseded close must not report bob as away either.
    aliceWs.send({ type: 'joinGame', roomId });
    const aliceRejoined = expectKind(
      await aliceWs.next((m) => m.type === 'gameJoined'),
      'gameJoined',
    );
    expect(aliceRejoined.opponent).toBe('connected');

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
    const roomId = await createRoomViaRest(alice.cookie);
    const aliceWs = await connect(wsUrl, alice.userId, alice.cookie);
    let bobWs = await connect(wsUrl, bob.userId, bob.cookie);
    expectKind(await aliceWs.next(), 'connected');
    expectKind(await bobWs.next(), 'connected');

    aliceWs.send({ type: 'joinGame', roomId });
    expectKind(await aliceWs.next((m) => m.type === 'gameJoined'), 'gameJoined');
    bobWs.send({ type: 'joinGame', roomId });
    expectKind(await bobWs.next((m) => m.type === 'gameJoined'), 'gameJoined');
    // Drain alice's view of bob's first connect.
    expectKind(await aliceWs.next((m) => m.type === 'stateUpdated'), 'stateUpdated');
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
    expect(reconnect.opponent).toBe('connected');

    await aliceWs.close();
    await bobWs.close();
  });

  it('emits presenceUpdate disconnected to the opponent when a socket closes', async () => {
    const roomId = await createRoomViaRest(alice.cookie);
    const aliceWs = await connect(wsUrl, alice.userId, alice.cookie);
    const bobWs = await connect(wsUrl, bob.userId, bob.cookie);
    expectKind(await aliceWs.next(), 'connected');
    expectKind(await bobWs.next(), 'connected');

    aliceWs.send({ type: 'joinGame', roomId });
    expectKind(await aliceWs.next((m) => m.type === 'gameJoined'), 'gameJoined');

    bobWs.send({ type: 'joinGame', roomId });
    expectKind(await bobWs.next((m) => m.type === 'gameJoined'), 'gameJoined');
    // Drain alice's connection-side of bob's join (stateUpdated + presenceUpdate).
    expectKind(await aliceWs.next((m) => m.type === 'stateUpdated'), 'stateUpdated');
    const aliceSawBobConnect = expectKind(
      await aliceWs.next((m) => m.type === 'presenceUpdate'),
      'presenceUpdate',
    );
    expect(aliceSawBobConnect.opponent).toBe('connected');

    await bobWs.close();
    const aliceSawBobDisconnect = expectKind(
      await aliceWs.next((m) => m.type === 'presenceUpdate'),
      'presenceUpdate',
    );
    expect(aliceSawBobDisconnect.opponent).toBe('disconnected');
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
