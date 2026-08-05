import { type ClientMessage, type ServerMessage, ServerMessageSchema } from '@hive/protocol';

type MessageType = ServerMessage['type'];
type MessageOf<K extends MessageType> = Extract<ServerMessage, { type: K }>;
type Handler<K extends MessageType> = (msg: MessageOf<K>) => void;

export type WsClient = {
  readonly send: (msg: ClientMessage) => void;
  readonly on: <K extends MessageType>(type: K, handler: Handler<K>) => () => void;
  readonly close: () => void;
};

type Options = {
  readonly url: string;
  readonly playerId?: string;
};

const buildUrl = (url: string, playerId: string | undefined): string => {
  if (playerId === undefined || playerId.length === 0) return url;
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}playerId=${encodeURIComponent(playerId)}`;
};

// Contract: handlers must be registered synchronously immediately after
// createWsClient() returns. JS is single-threaded and the WebSocket 'open'
// event is a task (not a microtask), so the caller's setup block completes
// before any handler fires.
export const createWsClient = ({ url, playerId }: Options): WsClient => {
  const ws = new WebSocket(buildUrl(url, playerId));
  const handlers = new Map<MessageType, Set<(msg: ServerMessage) => void>>();
  const queue: ClientMessage[] = [];
  let closed = false;

  ws.addEventListener('open', () => {
    if (closed || ws.readyState !== WebSocket.OPEN) return;
    for (const msg of queue) ws.send(JSON.stringify(msg));
    queue.length = 0;
  });

  ws.addEventListener('close', () => {
    closed = true;
    queue.length = 0;
  });

  ws.addEventListener('message', (e: MessageEvent) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof e.data === 'string' ? e.data : String(e.data));
    } catch {
      console.warn('ws: invalid JSON');
      return;
    }
    const result = ServerMessageSchema.safeParse(parsed);
    if (!result.success) {
      console.warn('ws: invalid message', result.error.message);
      return;
    }
    const msg = result.data;
    const set = handlers.get(msg.type);
    if (set === undefined) return;
    for (const h of set) h(msg);
  });

  const send = (msg: ClientMessage): void => {
    if (closed) return;
    if (ws.readyState !== WebSocket.OPEN) {
      queue.push(msg);
      return;
    }
    ws.send(JSON.stringify(msg));
  };

  const on = <K extends MessageType>(type: K, handler: Handler<K>): (() => void) => {
    let set = handlers.get(type);
    if (set === undefined) {
      set = new Set();
      handlers.set(type, set);
    }
    // Typed handler is widened at storage; dispatch only invokes handlers
    // whose key matches msg.type, so the cast is sound.
    const widened = handler as (msg: ServerMessage) => void;
    set.add(widened);
    return () => {
      set?.delete(widened);
    };
  };

  const close = (): void => {
    closed = true;
    queue.length = 0;
    handlers.clear();
    ws.close();
  };

  return { send, on, close };
};
