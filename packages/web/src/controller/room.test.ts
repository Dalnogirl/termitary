import { type Move, createGame, listValidMoves } from '@termitary/engine';
import type { ClientMessage, ServerMessage } from '@termitary/protocol';
import { toWire } from '@termitary/protocol';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WsClient, WsStatus } from '../network/client.js';
import { gameStore } from '../store/store.js';

type MessageType = ServerMessage['type'];

const sent: ClientMessage[] = [];
const messageHandlers = new Map<MessageType, (msg: ServerMessage) => void>();
let emitStatus: (status: WsStatus) => void = () => {};

const fakeClient: WsClient = {
  send: (msg) => {
    sent.push(msg);
  },
  on: (type, handler) => {
    messageHandlers.set(type, handler as (msg: ServerMessage) => void);
    return () => messageHandlers.delete(type);
  },
  onStatusChange: (handler) => {
    emitStatus = handler;
    return () => {
      emitStatus = () => {};
    };
  },
  close: () => {},
};

vi.mock('../network/client.js', () => ({ createWsClient: () => fakeClient }));

const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), { error: (m: string) => toastError(m) }),
}));

const { createRoomController } = await import('./room.js');

const deliver = (msg: ServerMessage): void => {
  const handler = messageHandlers.get(msg.type);
  if (handler === undefined) throw new Error(`no handler for ${msg.type}`);
  handler(msg);
};

const firstMove = (): Move => {
  const move = listValidMoves(gameStore.getState().liveGame)[0];
  if (move === undefined) throw new Error('no valid moves');
  return move;
};

// Brings a controller to the state a player is in mid-game: socket open,
// joined as white, one optimistic move sent and unanswered.
const setup = () => {
  const controller = createRoomController({ roomId: 'r1' });
  emitStatus('open');
  deliver({
    type: 'gameJoined',
    roomId: 'r1',
    playerColor: 'white',
    state: toWire(createGame()),
    opponent: 'connected',
  });
  return controller;
};

describe('createRoomController', () => {
  beforeEach(() => {
    sent.length = 0;
    messageHandlers.clear();
    toastError.mockClear();
    gameStore.getState().reset();
  });

  it('surfaces the reason a server-rejected move rolled back', () => {
    const controller = setup();
    const before = gameStore.getState().liveGame;

    controller.commitMove(firstMove());
    expect(gameStore.getState().liveGame).not.toBe(before);

    deliver({ type: 'error', message: 'not your turn', requestKind: 'makeMove' });

    expect(toastError).toHaveBeenCalledWith('not your turn');
    expect(gameStore.getState().liveGame).toBe(before);
    expect(gameStore.getState().selection).toBeNull();
  });

  it('re-joins for authoritative state when a rejection has no snapshot to restore', () => {
    const controller = setup();
    controller.commitMove(firstMove());

    // Clears the snapshot, as any stateUpdated does.
    deliver({ type: 'stateUpdated', roomId: 'r1', state: toWire(createGame()) });
    sent.length = 0;

    deliver({ type: 'error', message: 'not your turn', requestKind: 'makeMove' });

    expect(toastError).toHaveBeenCalledWith('not your turn');
    expect(sent).toEqual([{ type: 'joinGame', roomId: 'r1' }]);
  });

  it('drops a second move while one is still unanswered', () => {
    const controller = setup();
    controller.commitMove(firstMove());
    const afterFirst = gameStore.getState().liveGame;
    sent.length = 0;

    controller.commitMove(firstMove());

    expect(sent).toEqual([]);
    expect(gameStore.getState().liveGame).toBe(afterFirst);
  });

  it('keeps taking the fatal path for errors that are not move rejections', () => {
    const controller = setup();

    deliver({ type: 'error', message: 'room not found', requestKind: 'joinGame' });

    expect(controller.store.getState()).toMatchObject({
      status: 'error',
      errorMsg: 'room not found',
    });
    expect(toastError).not.toHaveBeenCalled();
  });
});
