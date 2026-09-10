import { type Color, type GameState, type Move, applyMove } from '@hive/engine';
import { type OpponentPresence, fromWire, toWireMove } from '@hive/protocol';
import { toast } from 'sonner';
import { type StoreApi, createStore } from 'zustand';
import { createWsClient } from '../network/client.js';
import { getWsUrl } from '../network/url.js';
import { gameStore } from '../store/store.js';
import type { Controller } from './port.js';

export type RoomStatus = 'connecting' | 'in-room' | 'reconnecting' | 'error';

export type RoomState = {
  readonly status: RoomStatus;
  readonly myColor: Color | null;
  readonly errorMsg: string | null;
  readonly opponent: OpponentPresence;
};

export const INITIAL_ROOM_STATE: RoomState = {
  status: 'connecting',
  myColor: null,
  errorMsg: null,
  opponent: 'empty',
};

export type RoomController = Controller & {
  readonly store: StoreApi<RoomState>;
  readonly leave: () => void;
  readonly dispose: () => void;
};

type Options = {
  readonly roomId: string;
};

// Owns the WS connection and ALL server-message bindings for a single
// /play/:roomId session. Translates protocol messages into either
// gameStore mutations (engine state) or local RoomState mutations
// (connection status / seat color / surfaced errors). No React.
export const createRoomController = ({ roomId }: Options): RoomController => {
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

  const offError = client.on('error', (msg) => {
    if (msg.requestKind === 'makeMove') {
      toast.error(msg.message);
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
    store.setState({ status: 'error', errorMsg: msg.message });
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
    store.setState({ status: 'error', errorMsg: 'Connection lost' });
  });

  const commitMove = (move: Move): void => {
    const { status } = store.getState();
    if (status !== 'in-room') {
      // The board still highlights valid moves here, so a silent no-op would
      // read as the same dead board this status exists to expose.
      if (status === 'reconnecting') {
        toast('Reconnecting, moves are paused', { id: 'move-while-offline' });
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
    if (before.game.status !== 'in_progress') return;

    pendingSnapshot = before.game;
    try {
      before.applyGameState(applyMove(before.game, move));
    } catch (e) {
      // Local engine rejected the move. UI filters by validMoves so this
      // is unreachable in normal play. Abort the round-trip rather than
      // send a known-bad move.
      pendingSnapshot = null;
      const msg = e instanceof Error ? e.message : 'Move rejected';
      toast.error(msg);
      before.setSelection(null);
      return;
    }
    client.send({ type: 'makeMove', roomId, move: toWireMove(move) });
  };

  const leave = (): void => {
    client.send({ type: 'leaveGame', roomId });
  };

  const dispose = (): void => {
    offGameJoined();
    offStateUpdated();
    offPresenceUpdate();
    offError();
    offStatus();
    client.close();
  };

  return { store, commitMove, leave, dispose };
};
