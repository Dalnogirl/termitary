import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { fromWire } from '@hive/protocol';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { InputProvider } from '../controller/InputProvider.js';
import { type NetworkController, createNetworkController } from '../controller/network.js';
import { type WsClient, createWsClient } from '../network/client.js';
import { getOrCreatePlayerId } from '../network/player-id.js';
import { getWsUrl } from '../network/url.js';
import { commit, getState, setMyColor, subscribe } from '../store/store.js';
import { GameLayout } from './GameLayout.js';

type Status = 'connecting' | 'in-room' | 'error';

export const PlayPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('connecting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [controller, setController] = useState<NetworkController | null>(null);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const clientRef = useRef<WsClient | null>(null);
  const storeState = useSyncExternalStore(subscribe, getState, getState);

  useEffect(() => {
    if (roomId === undefined || roomId.length === 0) return;
    setStatus('connecting');
    setErrorMsg(null);

    const client = createWsClient({ url: getWsUrl(), playerId: getOrCreatePlayerId() });
    clientRef.current = client;
    const networkController = createNetworkController({ client, roomId });

    const offGameJoined = client.on('gameJoined', (msg) => {
      commit(fromWire(msg.state));
      setMyColor(msg.playerColor);
      setStatus('in-room');
    });

    const offError = client.on('error', (msg) => {
      if (msg.requestKind === 'makeMove') return;
      setErrorMsg(msg.message);
      setStatus('error');
    });

    client.send({ type: 'joinGame', roomId });
    setController(networkController);

    // Navigate-away (NavLink, back button, refresh) is treated as a passive
    // disconnect: the WS closes, the server keeps the room, and re-visiting
    // /play/:roomId re-attaches via the server's S-3c-1 path. No leaveGame
    // here — that's the explicit "Leave game" button's job below.
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

  const handleConfirmLeave = (): void => {
    setShowLeaveDialog(false);
    if (clientRef.current && roomId !== undefined) {
      clientRef.current.send({ type: 'leaveGame', roomId });
    }
    void navigate('/lobby');
  };

  if (status === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center flex-col gap-4">
        <p className="text-foreground">{errorMsg ?? 'Unknown error'}</p>
        <Button asChild variant="secondary">
          <Link to="/lobby">Back to lobby</Link>
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

  const gameOver = storeState.game.status === 'finished';

  return (
    <InputProvider controller={controller}>
      <div className="flex flex-col flex-1 min-h-0">
        <div className="flex items-center justify-between gap-4 px-5 py-2 border-b border-border text-xs text-muted-foreground">
          <span>
            Room <span className="font-mono">{roomId}</span> — share this URL to invite.
          </span>
          {!gameOver && (
            <Button variant="ghost" size="sm" onClick={() => setShowLeaveDialog(true)}>
              Leave game
            </Button>
          )}
        </div>
        <GameLayout />
      </div>
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave game?</AlertDialogTitle>
            <AlertDialogDescription>
              Leaving forfeits the match — the room will close and your opponent will be notified.
              To take a break and come back later, just navigate away; you can re-open this URL to
              rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmLeave}>Leave game</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </InputProvider>
  );
};
