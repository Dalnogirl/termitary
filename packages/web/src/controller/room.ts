import { type Color, type GameState, type Move, applyMove } from '@termitary/engine';
import { type OpponentPresence, fromWire, toWireMove } from '@termitary/protocol';
import { type StoreApi, createStore } from 'zustand';
import type { Notifier } from '../lib/notify.js';
import { createWsClient } from '../network/client.js';
import { getWsUrl } from '../network/url.js';
import { gameStore } from '../store/store.js';
import type { Controller } from './port.js';

// 'archived' is terminal like 'error': the game has ended and its room is gone,
// so the page moves to the archived game.
export type RoomStatus = 'connecting' | 'in-room' | 'reconnecting' | 'archived' | 'error';

export type RoomState = {
  readonly status: RoomStatus;
  readonly myColor: Color | null;
  // null until gameJoined answers.
  readonly opponent: OpponentPresence | null;
};

export const INITIAL_ROOM_STATE: RoomState = {
  status: 'connecting',
  myColor: null,
  opponent: null,
};

export type RoomController = Controller & {
  readonly store: StoreApi<RoomState>;
  readonly resign: () => void;
  readonly dispose: () => void;
};

type Options = {
  readonly roomId: string;
  readonly notifier: Notifier;
};

// Owns the WS connection and ALL server-message bindings for a single
// /play/:roomId session. Translates protocol messages into either
// gameStore mutations (engine state) or local RoomState mutations
// (connection status / seat color / surfaced errors). No React.
export const createRoomController = ({ roomId, notifier }: Options): RoomController => {
  // The board is a module-level singleton, so without this the room renders
  // whatever the last view left in it (the home page demo, a hot-seat game)
  // for the whole handshake, until gameJoined arrives.
  gameStore.getState().reset();

  const store = createStore<RoomState>(() => INITIAL_ROOM_STATE);
  const client = createWsClient({ url: getWsUrl() });

  // Last pre-move state. If the server rejects the move, we roll back to
  // this. Cleared on stateUpdated (any stateUpdated wins — server is the
  // source of truth).
  let pendingSnapshot: GameState | null = null;

  // A room fails once: the page leaves on the first failure, and a socket
  // closing behind a server error would otherwise toast a second reason.
  const fail = (message: string): void => {
    if (store.getState().status === 'error') return;
    notifier.error(message);
    store.setState({ status: 'error' });
  };

  const offGameJoined = client.on('gameJoined', (msg) => {
    gameStore.getState().applyGameState(fromWire(msg.state));
    store.setState({ status: 'in-room', myColor: msg.playerColor, opponent: msg.opponent });
  });

  const offStateUpdated = client.on('stateUpdated', (msg) => {
    pendingSnapshot = null;
    gameStore.getState().applyGameState(fromWire(msg.state));
  });

  const offPresenceUpdate = client.on('presenceUpdate', (msg) => {
    store.setState({ opponent: msg.opponent });
  });

  const offGameArchived = client.on('gameArchived', () => {
    pendingSnapshot = null;
    store.setState({ status: 'archived' });
  });

  const offError = client.on('error', (msg) => {
    if (msg.requestKind === 'makeMove') {
      notifier.error(msg.message);
      gameStore.getState().setSelection(null);
      if (pendingSnapshot !== null) {
        gameStore.getState().applyGameState(pendingSnapshot);
        pendingSnapshot = null;
        return;
      }
      // A stateUpdated landed between the send and this rejection, so there is
      // nothing to roll back to and the local board is of unknown provenance.
      // Re-join for authoritative state rather than reconstruct it.
      client.send({ type: 'joinGame', roomId });
      return;
    }
    fail(msg.message);
  });

  const offStatus = client.onStatusChange((status) => {
    if (status === 'open') {
      // Also the first open. On a reconnect the server takes joinGame's
      // re-attach branch and answers with authoritative state, which the
      // gameJoined handler above already applies.
      client.send({ type: 'joinGame', roomId });
      return;
    }
    if (status === 'reconnecting') {
      // Optimistic application is only safe while a rejection can still come
      // back, so drop the snapshot nothing will roll back to.
      pendingSnapshot = null;
      store.setState({ status: 'reconnecting' });
      return;
    }
    fail('Connection lost');
  });

  const commitMove = (move: Move): void => {
    const { status } = store.getState();
    if (status !== 'in-room') {
      // The board still highlights valid moves here, so a silent no-op would
      // read as the same dead board this status exists to expose.
      if (status === 'reconnecting') {
        notifier.info('Reconnecting, moves are paused', { id: 'move-while-offline' });
      }
      return;
    }

    if (pendingSnapshot !== null) {
      // One snapshot, so a second optimistic move would overwrite the state the
      // first one rolls back to. Unreachable while validMoves gates input —
      // after your move it is the opponent's turn locally.
      return;
    }

    const before = gameStore.getState();
    if (before.liveGame.status !== 'in_progress') return;

    pendingSnapshot = before.liveGame;
    try {
      before.applyGameState(applyMove(before.liveGame, move));
    } catch (e) {
      // Local engine rejected the move. UI filters by validMoves so this
      // is unreachable in normal play. Abort the round-trip rather than
      // send a known-bad move.
      pendingSnapshot = null;
      const msg = e instanceof Error ? e.message : 'Move rejected';
      notifier.error(msg);
      before.setSelection(null);
      return;
    }
    client.send({ type: 'makeMove', roomId, move: toWireMove(move) });
  };

  const resign = (): void => {
    const { status } = store.getState();
    if (status !== 'in-room') {
      // Same reason commitMove refuses: the send would be dropped on the
      // floor and a closed dialog would read as a resignation that happened.
      if (status === 'reconnecting') {
        notifier.info('Reconnecting, resign is paused', { id: 'resign-while-offline' });
      }
      return;
    }
    client.send({ type: 'resign', roomId });
  };

  const dispose = (): void => {
    offGameJoined();
    offStateUpdated();
    offPresenceUpdate();
    offGameArchived();
    offError();
    offStatus();
    client.close();
  };

  return { store, commitMove, resign, dispose };
};
