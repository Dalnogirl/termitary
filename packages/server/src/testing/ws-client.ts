import type { ClientMessage, ServerMessage } from '@termitary/protocol';
import { ServerMessageSchema } from '@termitary/protocol';
import { expect } from 'vitest';
import { WebSocket } from 'ws';

export type TestClient = {
  readonly playerId: string;
  next(predicate?: (m: ServerMessage) => boolean): Promise<ServerMessage>;
  send(msg: ClientMessage): void;
  close(): Promise<void>;
};

export const connect = async (
  url: string,
  playerId: string,
  cookie: string,
): Promise<TestClient> => {
  const ws = new WebSocket(url, { headers: { cookie } });
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

export const expectKind = <K extends ServerMessage['type']>(
  msg: ServerMessage,
  kind: K,
): Extract<ServerMessage, { type: K }> => {
  expect(msg.type).toBe(kind);
  if (msg.type !== kind) throw new Error('unreachable');
  return msg as Extract<ServerMessage, { type: K }>;
};
