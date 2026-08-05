import { type GameState, type Move, applyMove } from '@hive/engine';
import { fromWire, toWireMove } from '@hive/protocol';
import type { WsClient } from '../network/client.js';
import { commit, getState, setSelection } from '../store/store.js';
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
    const before = getState();
    if (before.game.status !== 'in_progress') return;

    pendingSnapshot = before.game;

    try {
      commit(applyMove(before.game, move));
    } catch (e) {
      // Local engine rejected the move. UI is supposed to filter by
      // validMoves so this is unreachable in normal play. Abort the
      // round-trip rather than send a known-bad move to the server.
      pendingSnapshot = null;
      console.warn('local applyMove failed:', e);
      setSelection(null);
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
    commit(fromWire(msg.state));
  });

  const offError = client.on('error', (msg) => {
    if (msg.requestKind === 'makeMove' && pendingSnapshot !== null) {
      commit(pendingSnapshot);
      pendingSnapshot = null;
    }
  });

  const dispose = (): void => {
    offStateUpdated();
    offError();
  };

  return { commitMove, dispose };
};
