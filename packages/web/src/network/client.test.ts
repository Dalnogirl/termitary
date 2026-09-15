import type { ClientMessage, ServerMessage } from '@termitary/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type WsStatus, createWsClient } from './client.js';

type Listener = (e: unknown) => void;

// A stand-in for the browser global. Constructible, so it is a class where the
// rest of the codebase would use a factory.
class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeWebSocket[] = [];

  readyState: number = FakeWebSocket.CONNECTING;
  readonly sent: string[] = [];
  private readonly listeners = new Map<string, Set<Listener>>();

  constructor(readonly url: string) {
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, fn: Listener): void {
    let set = this.listeners.get(type);
    if (set === undefined) {
      set = new Set();
      this.listeners.set(type, set);
    }
    set.add(fn);
  }

  send(data: string): void {
    this.sent.push(data);
  }

  close(): void {
    this.drop();
  }

  private fire(type: string, event: unknown): void {
    for (const fn of this.listeners.get(type) ?? []) fn(event);
  }

  /** The socket finishes its handshake. */
  accept(): void {
    this.readyState = FakeWebSocket.OPEN;
    this.fire('open', {});
  }

  /** The socket dies, from either end. */
  drop(): void {
    if (this.readyState === FakeWebSocket.CLOSED) return;
    this.readyState = FakeWebSocket.CLOSED;
    this.fire('close', {});
  }

  deliver(msg: unknown): void {
    this.fire('message', { data: JSON.stringify(msg) });
  }

  /** Replays a lifecycle event out of order, which a real socket never does. */
  emitRaw(type: 'open' | 'close'): void {
    this.fire(type, {});
  }
}

const latest = (): FakeWebSocket => {
  const socket = FakeWebSocket.instances.at(-1);
  if (socket === undefined) throw new Error('no socket was opened');
  return socket;
};

const parseSent = (socket: FakeWebSocket): ClientMessage[] =>
  socket.sent.map((raw) => JSON.parse(raw) as ClientMessage);

const PRESENCE: ServerMessage = {
  type: 'presenceUpdate',
  roomId: 'r1',
  opponent: { status: 'connected', userId: 'u2', name: 'Amber Beetle' },
};

// Mirrors the constants in client.ts: 500ms doubling to a 10s ceiling, 8 tries.
const DELAYS = [500, 1000, 2000, 4000, 8000, 10_000, 10_000, 10_000];

const setup = () => {
  const client = createWsClient({ url: 'ws://test/ws' });
  const statuses: WsStatus[] = [];
  client.onStatusChange((s) => statuses.push(s));
  return { client, statuses };
};

describe('createWsClient', () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    vi.useFakeTimers();
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reports open once the socket completes its handshake', () => {
    const { statuses } = setup();
    expect(statuses).toEqual([]);

    latest().accept();

    expect(statuses).toEqual(['open']);
  });

  it('reports reconnecting and opens a fresh socket after a drop', () => {
    const { statuses } = setup();
    latest().accept();

    latest().drop();

    expect(statuses).toEqual(['open', 'reconnecting']);
    expect(FakeWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(500);

    expect(FakeWebSocket.instances).toHaveLength(2);
    latest().accept();
    expect(statuses).toEqual(['open', 'reconnecting', 'open']);
  });

  it('keeps message handlers bound across a reconnect', () => {
    const { client } = setup();
    const seen: ServerMessage[] = [];
    client.on('presenceUpdate', (msg) => seen.push(msg));
    latest().accept();

    latest().drop();
    vi.advanceTimersByTime(500);
    latest().accept();
    latest().deliver(PRESENCE);

    expect(seen).toEqual([PRESENCE]);
  });

  it('doubles the delay between tries up to a ceiling', () => {
    setup();

    for (const delay of DELAYS) {
      const before = FakeWebSocket.instances.length;
      latest().drop();
      vi.advanceTimersByTime(delay - 1);
      expect(FakeWebSocket.instances).toHaveLength(before);
      vi.advanceTimersByTime(1);
      expect(FakeWebSocket.instances).toHaveLength(before + 1);
    }
  });

  it('gives up after the last try and reports closed', () => {
    const { statuses } = setup();

    for (const delay of DELAYS) {
      latest().drop();
      vi.advanceTimersByTime(delay);
    }
    latest().drop();

    expect(statuses.at(-1)).toBe('closed');
    expect(FakeWebSocket.instances).toHaveLength(DELAYS.length + 1);

    vi.advanceTimersByTime(60_000);
    expect(FakeWebSocket.instances).toHaveLength(DELAYS.length + 1);
  });

  it('restarts the ladder after a reconnect succeeds', () => {
    setup();
    latest().accept();

    latest().drop();
    vi.advanceTimersByTime(500);
    latest().accept();
    latest().drop();

    vi.advanceTimersByTime(499);
    expect(FakeWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeWebSocket.instances).toHaveLength(3);
  });

  it('stops retrying once the caller closes it', () => {
    const { client, statuses } = setup();
    latest().accept();

    latest().drop();
    client.close();
    vi.advanceTimersByTime(60_000);

    expect(FakeWebSocket.instances).toHaveLength(1);
    expect(statuses).toEqual(['open', 'reconnecting']);
  });

  it('drops outbound messages while the socket is not open', () => {
    const { client } = setup();
    const first = latest();

    client.send({ type: 'joinGame', roomId: 'r1' });
    expect(first.sent).toEqual([]);

    first.accept();
    client.send({ type: 'joinGame', roomId: 'r1' });
    expect(parseSent(first)).toEqual([{ type: 'joinGame', roomId: 'r1' }]);

    // Nothing queued during the outage is replayed onto the new socket: the
    // server may already have applied it before the drop.
    first.drop();
    client.send({ type: 'joinGame', roomId: 'r1' });
    vi.advanceTimersByTime(500);
    latest().accept();
    expect(latest().sent).toEqual([]);
  });

  it('ignores a late event from a socket it has already replaced', () => {
    const { statuses } = setup();
    const first = latest();
    first.accept();
    first.drop();
    vi.advanceTimersByTime(500);
    latest().accept();

    first.emitRaw('close');
    first.emitRaw('open');

    expect(statuses).toEqual(['open', 'reconnecting', 'open']);
    expect(FakeWebSocket.instances).toHaveLength(2);
  });
});
