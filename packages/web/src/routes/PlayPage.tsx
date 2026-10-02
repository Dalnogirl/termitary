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
import type { OpponentPresence } from '@termitary/protocol';
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { InputProvider } from '../controller/InputProvider.js';
import { RoomProvider } from '../controller/RoomContext.js';
import type { RoomStatus } from '../controller/room.js';
import { useRoomConnection } from '../controller/use-room-connection.js';
import { useGameStore } from '../store/store.js';
import { GameLayout } from './GameLayout.js';
import { paths } from './paths.js';
import { useArchiveRedirect } from './use-archive-redirect.js';

const PRESENCE_DOT: Record<OpponentPresence['status'], string> = {
  connected: 'bg-emerald-500',
  disconnected: 'bg-amber-500',
};

const PresenceBadge = ({ opponent }: { opponent: OpponentPresence }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`inline-block size-2 rounded-full ${PRESENCE_DOT[opponent.status]}`} />
    <span>
      <Link
        to={paths.profile(opponent.userId)}
        viewTransition
        className="no-underline text-foreground hover:underline"
      >
        {opponent.name}
      </Link>
      {opponent.status === 'disconnected' && ' disconnected'}
    </span>
  </span>
);

// A presenceUpdate can only arrive over the socket that is currently down, so
// while reconnecting the last reading of the opponent is unverifiable. Report
// our own connection rather than that stale reading.
const ConnectionBadge = ({
  status,
  opponent,
}: { status: RoomStatus; opponent: OpponentPresence | null }) => {
  if (status === 'reconnecting') {
    return (
      <span className="inline-flex items-center gap-1.5 text-amber-600">
        <span className="inline-block size-2 animate-pulse rounded-full bg-amber-500" />
        <span>Reconnecting…</span>
      </span>
    );
  }
  // The empty span holds Resign to the right while gameJoined is in flight.
  return opponent === null ? <span /> : <PresenceBadge opponent={opponent} />;
};

export const PlayPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const room = useRoomConnection(roomId);
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const gameStatus = useGameStore((s) => s.liveGame.status);
  useArchiveRedirect(room.status, roomId);

  // The finished board stays up behind the game-over modal; only a return
  // to the room is sent on to the archive.
  const handleConfirmQuit = (): void => {
    setShowQuitDialog(false);
    room.resign();
  };

  if (room.status === 'error') return <Navigate to={paths.home} />;
  if (room.status === 'archived') return null;
  if (room.controller === null) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        Connecting…
      </div>
    );
  }

  const gameOver = gameStatus === 'finished';

  return (
    <RoomProvider myColor={room.myColor} opponent={room.opponent}>
      <InputProvider controller={room.controller}>
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex items-center justify-between gap-4 px-5 py-2 border-b border-border text-xs text-muted-foreground">
            <ConnectionBadge status={room.status} opponent={room.opponent} />
            {!gameOver && (
              <Button
                variant="ghost"
                size="sm"
                disabled={room.status !== 'in-room'}
                onClick={() => setShowQuitDialog(true)}
              >
                Resign
              </Button>
            )}
          </div>
          <GameLayout />
        </div>
        <AlertDialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Resign?</AlertDialogTitle>
              <AlertDialogDescription>
                Resigning loses the game. The final position stays here for both of you to look at.
                To take a break instead, navigate away and re-open this URL to come back.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep playing</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmQuit}>Resign</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </InputProvider>
    </RoomProvider>
  );
};
