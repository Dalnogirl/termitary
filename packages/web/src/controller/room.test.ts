// @vitest-environment jsdom
import {
  type GameState,
  type Move,
  applyMove,
  createGame,
  listValidMoves,
} from '@termitary/engine';
import type { ClientMessage, ServerGameJoined, ServerMessage } from '@termitary/protocol';
import { toWire } from '@termitary/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { WsClient, WsStatus } from '../network/client.js';
import { gameStore } from '../store/store.js';

type MessageType = ServerMessage['type'];

const sent: ClientMessage[] = [];
const messageHandlers = new Map<MessageType, (msg: ServerMessage) => void>();
let emitStatus: (status: WsStatus) => void = () => {};
let closed = false;

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
  close: () => {
    closed = true;
  },
};

vi.mock('../network/client.js', () => ({ createWsClient: () => fakeClient }));

const notifier = { error: vi.fn(), info: vi.fn() };

const { createRoomController } = await import('./room.js');

const UNTIMED_CLOCK = {
  timeControl: { kind: 'untimed' },
  remainingMs: null,
  firstMoveMs: null,
} as const;

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
const setup = (
  clock: ServerGameJoined['clock'] = UNTIMED_CLOCK,
  state: GameState = createGame(),
) => {
  const controller = createRoomController({ roomId: 'r1', notifier });
  emitStatus('open');
  deliver({
    type: 'gameJoined',
    roomId: 'r1',
    playerColor: 'white',
    state: toWire(state),
    clock,
    opponent: { status: 'connected', userId: 'u2', name: 'Amber Beetle' },
  });
  return controller;
};

describe('createRoomController', () => {
  beforeEach(() => {
    sent.length = 0;
    messageHandlers.clear();
    notifier.error.mockClear();
    notifier.info.mockClear();
    closed = false;
    gameStore.getState().reset();
  });

  it('seats the color and opponent the server assigns', () => {
    const controller = setup();

    expect(controller.store.getState()).toMatchObject({
      status: 'in-room',
      myColor: 'white',
      opponent: { status: 'connected', userId: 'u2', name: 'Amber Beetle' },
      clock: { reading: UNTIMED_CLOCK, toMove: 'white' },
    });
    expect(gameStore.getState().liveGame).toEqual(createGame());
  });

  it('follows the opponent out of the room and back in', () => {
    const controller = setup();
    const away = { status: 'disconnected', userId: 'u2', name: 'Amber Beetle' } as const;

    deliver({ type: 'presenceUpdate', roomId: 'r1', opponent: away });

    expect(controller.store.getState().opponent).toEqual(away);
    expect(controller.store.getState().status).toBe('in-room');

    deliver({
      type: 'presenceUpdate',
      roomId: 'r1',
      opponent: { ...away, status: 'connected' },
    });

    expect(controller.store.getState().opponent).toEqual({ ...away, status: 'connected' });
  });

  it('takes the server board over an optimistic one', () => {
    const controller = setup();
    controller.commitMove(firstMove());

    const authoritative = createGame();
    deliver({
      type: 'stateUpdated',
      roomId: 'r1',
      state: toWire(authoritative),
      clock: UNTIMED_CLOCK,
    });

    expect(gameStore.getState().liveGame).toEqual(authoritative);
  });

  it('unbinds every handler and closes the socket on dispose', () => {
    const controller = setup();
    sent.length = 0;

    controller.dispose();

    expect(closed).toBe(true);
    expect(messageHandlers.size).toBe(0);

    // A reconnect on a disposed controller would otherwise re-join a room
    // the player has navigated away from.
    emitStatus('open');
    expect(sent).toEqual([]);
  });

  it('surfaces the reason a server-rejected move rolled back', () => {
    const controller = setup();
    const before = gameStore.getState().liveGame;

    controller.commitMove(firstMove());
    expect(gameStore.getState().liveGame).not.toBe(before);

    deliver({ type: 'error', message: 'not your turn', requestKind: 'makeMove' });

    expect(notifier.error).toHaveBeenCalledTimes(1);
    expect(notifier.error).toHaveBeenCalledWith('not your turn');
    expect(controller.store.getState().status).toBe('in-room');
    expect(gameStore.getState().liveGame).toBe(before);
    expect(gameStore.getState().selection).toBeNull();
  });

  it('re-joins for authoritative state when a rejection has no snapshot to restore', () => {
    const controller = setup();
    controller.commitMove(firstMove());

    // Clears the snapshot, as any stateUpdated does.
    deliver({
      type: 'stateUpdated',
      roomId: 'r1',
      state: toWire(createGame()),
      clock: UNTIMED_CLOCK,
    });
    sent.length = 0;

    deliver({ type: 'error', message: 'not your turn', requestKind: 'makeMove' });

    expect(notifier.error).toHaveBeenCalledWith('not your turn');
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

  it('sends resign and takes the finished state from the server', () => {
    const controller = setup();
    sent.length = 0;

    controller.resign();
    expect(sent).toEqual([{ type: 'resign', roomId: 'r1' }]);

    deliver({
      type: 'stateUpdated',
      roomId: 'r1',
      state: {
        ...toWire(createGame()),
        status: 'finished',
        result: 'black-wins',
        endReason: 'resignation',
      },
      clock: UNTIMED_CLOCK,
    });

    const game = gameStore.getState().liveGame;
    expect(game.status).toBe('finished');
    if (game.status !== 'finished') throw new Error('unreachable');
    expect(game.endReason).toBe('resignation');
    expect(controller.store.getState().status).toBe('in-room');
  });

  it('holds moves and resign while reconnecting, and says why', () => {
    const controller = setup();
    emitStatus('reconnecting');
    sent.length = 0;

    controller.commitMove(firstMove());
    controller.resign();

    expect(sent).toEqual([]);
    expect(notifier.info).toHaveBeenCalledWith('Reconnecting, moves are paused', {
      id: 'move-while-offline',
    });
    expect(notifier.info).toHaveBeenCalledWith('Reconnecting, resign is paused', {
      id: 'resign-while-offline',
    });
  });

  it('marks the room archived when the server says its game has moved there', () => {
    const controller = setup();

    deliver({ type: 'gameArchived', roomId: 'r1' });

    expect(controller.store.getState().status).toBe('archived');
    expect(notifier.error).not.toHaveBeenCalled();
  });

  it('marks the room aborted when the server says nobody started it, and says why', () => {
    const controller = setup();

    deliver({ type: 'gameAborted', roomId: 'r1' });

    expect(controller.store.getState().status).toBe('aborted');
    expect(notifier.info).toHaveBeenCalledWith('Game aborted: a first move was not made in time', {
      id: 'game-aborted',
    });
    expect(notifier.error).not.toHaveBeenCalled();
  });

  it('ignores an error that trails the abort', () => {
    const controller = setup();
    deliver({ type: 'gameAborted', roomId: 'r1' });
    sent.length = 0;

    deliver({ type: 'error', message: 'room not found', requestKind: 'makeMove' });
    deliver({ type: 'error', message: 'room not found', requestKind: 'resign' });

    expect(controller.store.getState().status).toBe('aborted');
    expect(notifier.error).not.toHaveBeenCalled();
    expect(sent).toEqual([]);
  });

  it('fails the room on an error that is not a move rejection, and says why', () => {
    const controller = setup();

    deliver({ type: 'error', message: 'room not found', requestKind: 'joinGame' });

    expect(controller.store.getState().status).toBe('error');
    expect(notifier.error).toHaveBeenCalledWith('room not found');
  });

  it('fails the room when the socket gives up reconnecting', () => {
    const controller = setup();

    emitStatus('closed');

    expect(controller.store.getState().status).toBe('error');
    expect(notifier.error).toHaveBeenCalledWith('Connection lost');
  });

  it('reports only the first reason a room failed', () => {
    setup();

    deliver({ type: 'error', message: 'room not found', requestKind: 'joinGame' });
    emitStatus('closed');

    expect(notifier.error).toHaveBeenCalledTimes(1);
  });

  describe('timeout claim', () => {
    const BLITZ = { kind: 'realtime', initialMs: 300_000, incrementMs: 3_000 } as const;
    const reading = (white: number, black: number) => ({
      timeControl: BLITZ,
      remainingMs: { white, black },
      firstMoveMs: null,
    });
    const blackToMove = (): GameState => {
      const game = createGame();
      const move = listValidMoves(game)[0];
      if (move === undefined) throw new Error('no valid moves');
      return applyMove(game, move);
    };
    const claims = () => sent.filter((msg) => msg.type === 'claimTimeout');

    beforeEach(() => {
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("claims once the opponent's time runs out", () => {
      setup(reading(200_000, 5_000), blackToMove());

      vi.advanceTimersByTime(4_999);
      expect(claims()).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(claims()).toEqual([{ type: 'claimTimeout', roomId: 'r1' }]);
    });

    it('repeats a claim the server let pass, backing off, until a new reading', () => {
      setup(reading(200_000, 5_000), blackToMove());

      vi.advanceTimersByTime(5_000);
      vi.advanceTimersByTime(500);
      expect(claims()).toHaveLength(2);
      vi.advanceTimersByTime(549);
      expect(claims()).toHaveLength(2);
      vi.advanceTimersByTime(1);
      expect(claims()).toHaveLength(3);

      deliver({
        type: 'stateUpdated',
        roomId: 'r1',
        state: toWire(createGame()),
        clock: reading(200_000, 5_000),
      });
      vi.advanceTimersByTime(60_000);
      expect(claims()).toHaveLength(3);
    });

    it("claims on the opponent's first-move window, not its bank", () => {
      setup({ ...reading(300_000, 300_000), firstMoveMs: 30_000 }, blackToMove());

      vi.advanceTimersByTime(30_000);
      expect(claims()).toHaveLength(1);
    });

    it('never claims against itself', () => {
      setup(reading(5_000, 200_000));

      vi.advanceTimersByTime(10_000);
      expect(claims()).toEqual([]);
    });

    it('rearms from each new reading rather than the first', () => {
      setup(reading(200_000, 5_000), blackToMove());
      vi.advanceTimersByTime(4_000);

      deliver({
        type: 'stateUpdated',
        roomId: 'r1',
        state: toWire(blackToMove()),
        clock: reading(200_000, 3_000),
      });
      vi.advanceTimersByTime(2_999);
      expect(claims()).toEqual([]);

      vi.advanceTimersByTime(1);
      expect(claims()).toHaveLength(1);
    });

    it('holds the claim while reconnecting and after the game is gone', () => {
      setup(reading(200_000, 5_000), blackToMove());
      emitStatus('reconnecting');
      vi.advanceTimersByTime(10_000);
      expect(claims()).toEqual([]);

      emitStatus('open');
      deliver({
        type: 'gameJoined',
        roomId: 'r1',
        playerColor: 'white',
        state: toWire(blackToMove()),
        clock: reading(200_000, 5_000),
        opponent: { status: 'connected', userId: 'u2', name: 'Amber Beetle' },
      });
      deliver({ type: 'gameArchived', roomId: 'r1' });
      vi.advanceTimersByTime(10_000);
      expect(claims()).toEqual([]);
    });
  });
});
