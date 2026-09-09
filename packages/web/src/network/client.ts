import { type ClientMessage, type ServerMessage, ServerMessageSchema } from '@hive/protocol';

type MessageType = ServerMessage['type'];
type MessageOf<K extends MessageType> = Extract<ServerMessage, { type: K }>;
type Handler<K extends MessageType> = (msg: MessageOf<K>) => void;

/** 'closed' is terminal: either close() was called, or the retries ran out. */
export type WsStatus = 'open' | 'reconnecting' | 'closed';

export type WsClient = {
  readonly send: (msg: ClientMessage) => void;
  readonly on: <K extends MessageType>(type: K, handler: Handler<K>) => () => void;
  readonly onStatusChange: (handler: (status: WsStatus) => void) => () => void;
  readonly close: () => void;
};

type Options = {
  readonly url: string;
};

const RECONNECT_BASE_MS = 500;
const RECONNECT_MAX_MS = 10_000;
const RECONNECT_MAX_ATTEMPTS = 8;

// Contract: handlers must be registered synchronously immediately after
// createWsClient() returns. JS is single-threaded and the WebSocket 'open'
// event is a task (not a microtask), so the caller's setup block completes
// before any handler fires. This now covers onStatusChange too, which is
// how the caller learns about the very first open.
//
// Message handlers outlive the socket: a reconnect swaps `activeSocket` and
// leaves the registry alone, so callers bind once and never rebind.
export const createWsClient = ({ url }: Options): WsClient => {
  const messageHandlers = new Map<MessageType, Set<(msg: ServerMessage) => void>>();
  const statusHandlers = new Set<(status: WsStatus) => void>();
  let activeSocket: WebSocket | undefined;
  let closedByCaller = false;
  let reconnectAttempts = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const emitStatus = (status: WsStatus): void => {
    // Copied: a handler is allowed to unsubscribe itself while it runs.
    for (const handler of [...statusHandlers]) handler(status);
  };

  const scheduleReconnect = (): void => {
    if (reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
      emitStatus('closed');
      return;
    }
    const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** reconnectAttempts);
    reconnectAttempts += 1;
    emitStatus('reconnecting');
    reconnectTimer = setTimeout(() => {
      if (closedByCaller) return;
      connect();
    }, delay);
  };

  const handleMessage = (e: MessageEvent): void => {
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
    const subscribers = messageHandlers.get(msg.type);
    if (subscribers === undefined) return;
    for (const handler of subscribers) handler(msg);
  };

  const connect = (): void => {
    const socket = new WebSocket(url);
    activeSocket = socket;

    // Listeners are never removed, so a socket we have already replaced still
    // fires into this closure. Its events must neither reset the backoff
    // ladder nor start a second one.
    const isCurrent = (): boolean => !closedByCaller && socket === activeSocket;

    socket.addEventListener('open', () => {
      if (!isCurrent()) return;
      reconnectAttempts = 0;
      emitStatus('open');
    });

    socket.addEventListener('close', () => {
      if (!isCurrent()) return;
      scheduleReconnect();
    });

    socket.addEventListener('message', handleMessage);
  };

  const send = (msg: ClientMessage): void => {
    if (closedByCaller) return;
    if (activeSocket?.readyState !== WebSocket.OPEN) return;
    activeSocket.send(JSON.stringify(msg));
  };

  const on = <K extends MessageType>(type: K, handler: Handler<K>): (() => void) => {
    let subscribers = messageHandlers.get(type);
    if (subscribers === undefined) {
      subscribers = new Set();
      messageHandlers.set(type, subscribers);
    }
    // Typed handler is widened at storage; dispatch only invokes handlers
    // whose key matches msg.type, so the cast is sound.
    const widened = handler as (msg: ServerMessage) => void;
    subscribers.add(widened);
    return () => {
      subscribers?.delete(widened);
    };
  };

  const onStatusChange = (handler: (status: WsStatus) => void): (() => void) => {
    statusHandlers.add(handler);
    return () => {
      statusHandlers.delete(handler);
    };
  };

  const close = (): void => {
    closedByCaller = true;
    if (reconnectTimer !== undefined) clearTimeout(reconnectTimer);
    messageHandlers.clear();
    statusHandlers.clear();
    activeSocket?.close();
  };

  connect();

  return { send, on, onStatusChange, close };
};
