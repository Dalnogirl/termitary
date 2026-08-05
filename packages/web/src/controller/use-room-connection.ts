import type { Color } from '@hive/engine';
import { fromWire } from '@hive/protocol';
import { useEffect, useRef, useState } from 'react';
import { type WsClient, createWsClient } from '../network/client.js';
import { getOrCreatePlayerId } from '../network/player-id.js';
import { getWsUrl } from '../network/url.js';
import { commit } from '../store/store.js';
import { type NetworkController, createNetworkController } from './network.js';

type Status = 'connecting' | 'in-room' | 'error';

export type RoomConnection = {
  readonly status: Status;
  readonly controller: NetworkController | null;
  readonly myColor: Color | null;
  readonly errorMsg: string | null;
  readonly leave: () => void;
};

// Owns the WS connection, network controller, and joinGame round-trip for a
// single /play/:roomId session.
export const useRoomConnection = (roomId: string | undefined): RoomConnection => {
  const [status, setStatus] = useState<Status>('connecting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [controller, setController] = useState<NetworkController | null>(null);
  const [myColor, setMyColor] = useState<Color | null>(null);
  const clientRef = useRef<WsClient | null>(null);

  useEffect(() => {
    if (roomId === undefined || roomId.length === 0) return;
    setStatus('connecting');
    setErrorMsg(null);
    setMyColor(null);

    const client = createWsClient({
      url: getWsUrl(),
      playerId: getOrCreatePlayerId(),
    });
    clientRef.current = client;
    const networkController = createNetworkController({ client, roomId });

    const offGameJoined = client.on('gameJoined', (msg) => {
      commit(fromWire(msg.state));
      setMyColor(msg.playerColor);
      setStatus('in-room');
    });

    // Move-errors are owned by the network controller (rollback). The hook
    // surfaces only the non-move errors: join failures, opponent-left, etc.
    const offError = client.on('error', (msg) => {
      if (msg.requestKind === 'makeMove') return;
      setErrorMsg(msg.message);
      setStatus('error');
    });

    client.send({ type: 'joinGame', roomId });
    setController(networkController);

    return () => {
      offGameJoined();
      offError();
      networkController.dispose();
      client.close();
      clientRef.current = null;
      setController(null);
      setMyColor(null);
    };
  }, [roomId]);

  const leave = (): void => {
    if (clientRef.current && roomId !== undefined) {
      clientRef.current.send({ type: 'leaveGame', roomId });
    }
  };

  return { status, controller, myColor, errorMsg, leave };
};
