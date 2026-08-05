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
import type { OpponentPresence } from '@hive/protocol';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { InputProvider } from '../controller/InputProvider.js';
import { RoomProvider } from '../controller/RoomContext.js';
import { useRoomConnection } from '../controller/use-room-connection.js';
import { useGameStore } from '../store/store.js';
import { GameLayout } from './GameLayout.js';

const PRESENCE_DOT: Record<OpponentPresence, string> = {
  empty: 'bg-muted-foreground/40',
  connected: 'bg-emerald-500',
  disconnected: 'bg-amber-500',
};

const PRESENCE_LABEL: Record<OpponentPresence, string> = {
  empty: 'Waiting for opponent…',
  connected: 'Opponent connected',
  disconnected: 'Opponent disconnected',
};

const PresenceBadge = ({ opponent }: { opponent: OpponentPresence }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`inline-block size-2 rounded-full ${PRESENCE_DOT[opponent]}`} />
    <span>{PRESENCE_LABEL[opponent]}</span>
  </span>
);

export const PlayPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const room = useRoomConnection(roomId);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const gameStatus = useGameStore((s) => s.game.status);

  const handleConfirmLeave = (): void => {
    setShowLeaveDialog(false);
    room.leave();
    void navigate('/lobby');
  };

  if (room.status === 'error') {
    return (
      <div className="flex flex-1 items-center justify-center flex-col gap-4">
        <p className="text-foreground">{room.errorMsg ?? 'Unknown error'}</p>
        <Button asChild variant="secondary">
          <Link to="/lobby">Back to lobby</Link>
        </Button>
      </div>
    );
  }
  if (room.controller === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Connecting…
      </div>
    );
  }

  const gameOver = gameStatus === 'finished';

  return (
    <RoomProvider myColor={room.myColor}>
      <InputProvider controller={room.controller}>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between gap-4 px-5 py-2 border-b border-border text-xs text-muted-foreground">
            <span className="flex items-center gap-3">
              <span>
                Room <span className="font-mono">{roomId}</span> — share this URL to invite.
              </span>
              <PresenceBadge opponent={room.opponent} />
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
    </RoomProvider>
  );
};
