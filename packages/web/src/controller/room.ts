import { type Color, type GameState, type Move, applyMove } from '@hive/engine';
import { type OpponentPresence, fromWire, toWireMove } from '@hive/protocol';
import { toast } from 'sonner';
import { type StoreApi, createStore } from 'zustand';
import { createWsClient } from '../network/client.js';
import { getOrCreatePlayerId } from '../network/player-id.js';
import { getWsUrl } from '../network/url.js';
import { gameStore } from '../store/store.js';
import type { Controller } from './port.js';

export type RoomStatus = 'connecting' | 'in-room' | 'error';

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
  readonly playerId?: string;
};

// Owns the WS connection and ALL server-message bindings for a single
// /play/:roomId session. Translates protocol messages into either
// gameStore mutations (engine state) or local RoomState mutations
// (connection status / seat color / surfaced errors). No React.
export const createRoomController = ({ roomId, playerId }: Options): RoomController => {
  const store = createStore<RoomState>(() => INITIAL_ROOM_STATE);
  const client = createWsClient({
    url: getWsUrl(),
    playerId: playerId ?? getOrCreatePlayerId(),
  });

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
      if (pendingSnapshot !== null) {
        gameStore.getState().applyGameState(pendingSnapshot);
        pendingSnapshot = null;
      }
      return;
    }
    store.setState({ status: 'error', errorMsg: msg.message });
  });

  client.send({ type: 'joinGame', roomId });

  const commitMove = (move: Move): void => {
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
    client.close();
  };

  return { store, commitMove, leave, dispose };
};
