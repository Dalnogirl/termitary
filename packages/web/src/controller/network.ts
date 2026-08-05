import { type GameState, type Move, applyMove } from '@hive/engine';
import { fromWire, toWireMove } from '@hive/protocol';
import type { WsClient } from '../network/client.js';
import { gameStore } from '../store/store.js';
import type { Controller } from './port.js';

export type NetworkController = Controller & {
  readonly dispose: () => void;
};

type Options = {
  readonly client: WsClient;
  readonly roomId: string;
};

export const createNetworkController = ({ client, roomId }: Options): NetworkController => {
  // Last pre-move state. If the server rejects the move, we roll back to
  // this. Cleared when stateUpdated confirms the move was applied (or when
  // any stateUpdated arrives — server is the source of truth).
  let pendingSnapshot: GameState | null = null;

  const commitMove = (move: Move): void => {
    const before = gameStore.getState();
    if (before.game.status !== 'in_progress') return;

    pendingSnapshot = before.game;

    try {
      before.applyGameState(applyMove(before.game, move));
    } catch (e) {
      // Local engine rejected the move. UI is supposed to filter by
      // validMoves so this is unreachable in normal play. Abort the
      // round-trip rather than send a known-bad move to the server.
      pendingSnapshot = null;
      console.warn('local applyMove failed:', e);
      before.setSelection(null);
      return;
    }

    client.send({
      type: 'makeMove',
      roomId,
      move: toWireMove(move),
    });
  };

  const offStateUpdated = client.on('stateUpdated', (msg) => {
    pendingSnapshot = null;
    gameStore.getState().applyGameState(fromWire(msg.state));
  });

  const offError = client.on('error', (msg) => {
    if (msg.requestKind === 'makeMove' && pendingSnapshot !== null) {
      gameStore.getState().applyGameState(pendingSnapshot);
      pendingSnapshot = null;
    }
  });

  const dispose = (): void => {
    offStateUpdated();
    offError();
  };

  return { commitMove, dispose };
};
