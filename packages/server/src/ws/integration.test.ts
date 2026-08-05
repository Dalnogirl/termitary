import { listValidMoves } from '@hive/engine';
import {
  type ClientMessage,
  type ServerMessage,
  ServerMessageSchema,
  fromWire,
  toWireMove,
} from '@hive/protocol';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import { buildApp } from '../app.js';

type TestClient = {
  readonly playerId: string;
  next(predicate?: (m: ServerMessage) => boolean): Promise<ServerMessage>;
  send(msg: ClientMessage): void;
  close(): Promise<void>;
};

const connect = async (url: string, playerId: string): Promise<TestClient> => {
  const ws = new WebSocket(`${url}?playerId=${playerId}`);
  const queue: ServerMessage[] = [];
  const waiters: Array<{
    predicate: (m: ServerMessage) => boolean;
    resolve: (m: ServerMessage) => void;
  }> = [];

  ws.on('message', (raw: Buffer) => {
    const parsed = ServerMessageSchema.parse(JSON.parse(raw.toString()));
    const idx = waiters.findIndex((w) => w.predicate(parsed));
    if (idx >= 0) {
      const [w] = waiters.splice(idx, 1);
      w?.resolve(parsed);
    } else {
      queue.push(parsed);
    }
  });

  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });

  const next = (predicate: (m: ServerMessage) => boolean = () => true): Promise<ServerMessage> => {
    const idx = queue.findIndex(predicate);
    if (idx >= 0) {
      const [m] = queue.splice(idx, 1);
      if (!m) throw new Error('unreachable');
      return Promise.resolve(m);
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`timeout waiting for message; queue=${JSON.stringify(queue)}`));
      }, 2000);
      waiters.push({
        predicate,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m);
        },
      });
    });
  };

  return {
    playerId,
    next,
    send: (msg) => ws.send(JSON.stringify(msg)),
    close: () =>
      new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) return resolve();
        ws.once('close', () => resolve());
        ws.close();
      }),
  };
};

const expectKind = <K extends ServerMessage['type']>(
  msg: ServerMessage,
  kind: K,
): Extract<ServerMessage, { type: K }> => {
  expect(msg.type).toBe(kind);
  if (msg.type !== kind) throw new Error('unreachable');
  return msg as Extract<ServerMessage, { type: K }>;
};

describe('ws integration', () => {
  let app: FastifyInstance;
  let baseUrl: string;
  let wsUrl: string;

  const createRoomViaRest = async (playerId: string): Promise<string> => {
    const res = await app.inject({
      method: 'POST',
      url: '/rooms',
      payload: { playerId },
      headers: { 'content-type': 'application/json' },
    });
    const body = res.json() as { roomId: string };
    return body.roomId;
  };

  beforeEach(async () => {
    app = await buildApp();
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    wsUrl = `${baseUrl.replace('http://', 'ws://')}/ws`;
  });

  afterEach(async () => {
    await app.close();
  });

  it('drives a full create → join → move → leave flow between two clients', async () => {
    // Create over REST, the way the real client does (no WS until the join).
    const roomId = await createRoomViaRest('alice');

    const alice = await connect(wsUrl, 'alice');
    const bob = await connect(wsUrl, 'bob');

    expectKind(await alice.next(), 'connected');
    expectKind(await bob.next(), 'connected');

    // Alice rejoins her own room — server's re-attach path sends gameJoined.
    alice.send({ type: 'joinGame', roomId });
    const aliceJoined = expectKind(await alice.next((m) => m.type === 'gameJoined'), 'gameJoined');
    expect(aliceJoined.playerColor).toBe('white');
    expect(aliceJoined.roomId).toBe(roomId);

    // Bob joins as the second seat (black).
    bob.send({ type: 'joinGame', roomId });
    const bobJoined = expectKind(await bob.next((m) => m.type === 'gameJoined'), 'gameJoined');
    expect(bobJoined.playerColor).toBe('black');
    expect(bobJoined.roomId).toBe(roomId);

    const aliceJoinUpdate = expectKind(
      await alice.next((m) => m.type === 'stateUpdated'),
      'stateUpdated',
    );
    expect(aliceJoinUpdate.roomId).toBe(roomId);

    const firstMove = listValidMoves(fromWire(aliceJoined.state))[0];
    if (!firstMove) throw new Error('no valid first move');
    alice.send({ type: 'makeMove', roomId, move: toWireMove(firstMove) });

    const aliceAfterMove = expectKind(
      await alice.next((m) => m.type === 'stateUpdated'),
      'stateUpdated',
    );
    const bobAfterMove = expectKind(
      await bob.next((m) => m.type === 'stateUpdated'),
      'stateUpdated',
    );
    expect(fromWire(aliceAfterMove.state).currentPlayer).toBe('black');
    expect(fromWire(bobAfterMove.state).history.length).toBe(1);

    alice.send({ type: 'leaveGame', roomId });
    const opponentLeft = expectKind(
      await bob.next((m) => m.type === 'error' && m.message === 'opponent left'),
      'error',
    );
    expect(opponentLeft.message).toBe('opponent left');

    await alice.close();
    await bob.close();
  });

  it('returns an error tagged with requestKind for moves on unknown rooms', async () => {
    const alice = await connect(wsUrl, 'alice');
    expectKind(await alice.next(), 'connected');
    alice.send({ type: 'makeMove', roomId: 'nope', move: { kind: 'pass' } });
    const err = expectKind(await alice.next((m) => m.type === 'error'), 'error');
    expect(err.requestKind).toBe('makeMove');
    expect(err.message).toBe('room not found');
    await alice.close();
  });

  it('generates a playerId when none is provided', async () => {
    const ws = new WebSocket(`${wsUrl}`);
    const opened = new Promise<void>((res, rej) => {
      ws.once('open', () => res());
      ws.once('error', rej);
    });
    const firstMsg = new Promise<ServerMessage>((res) => {
      ws.once('message', (raw: Buffer) => {
        res(ServerMessageSchema.parse(JSON.parse(raw.toString())));
      });
    });
    await opened;
    const connected = expectKind(await firstMsg, 'connected');
    expect(connected.playerId.length).toBeGreaterThan(0);
    ws.close();
  });
});
