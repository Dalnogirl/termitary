import { Button } from '@/components/ui/button';
import { fromWire } from '@hive/protocol';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { InputProvider } from '../controller/InputProvider.js';
import { type NetworkController, createNetworkController } from '../controller/network.js';
import { createWsClient } from '../network/client.js';
import { getOrCreatePlayerId } from '../network/player-id.js';
import { getWsUrl } from '../network/url.js';
import { commit } from '../store/store.js';
import { GameLayout } from './GameLayout.js';

type Status = 'connecting' | 'in-room' | 'error';

export const PlayPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [status, setStatus] = useState<Status>('connecting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [controller, setController] = useState<NetworkController | null>(null);

  useEffect(() => {
    if (roomId === undefined || roomId.length === 0) return;
    setStatus('connecting');
    setErrorMsg(null);

    const client = createWsClient({ url: getWsUrl(), playerId: getOrCreatePlayerId() });
    const networkController = createNetworkController({ client, roomId });

    const offGameJoined = client.on('gameJoined', (msg) => {
      commit(fromWire(msg.state));
      setStatus('in-room');
    });

    // Move-errors are owned by the network controller (rollback). The route
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
      setController(null);
    };
  }, [roomId]);

  if (status === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center flex-col gap-4">
        <p className="text-foreground">{errorMsg ?? 'Unknown error'}</p>
        <Button asChild variant="secondary">
          <Link to="/hotseat">Back to hot-seat</Link>
        </Button>
      </div>
    );
  }
  if (controller === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Connecting…
      </div>
    );
  }

  return (
    <InputProvider controller={controller}>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-5 py-2 border-b border-border text-xs text-muted-foreground">
          Room <span className="font-mono">{roomId}</span> — share this URL to invite.
        </div>
        <GameLayout />
      </div>
    </InputProvider>
  );
};
