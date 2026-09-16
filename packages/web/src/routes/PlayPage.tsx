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
import { useQueryClient } from '@tanstack/react-query';
import type { OpponentPresence } from '@termitary/protocol';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { toast } from 'sonner';
import { InputProvider } from '../controller/InputProvider.js';
import { RoomProvider } from '../controller/RoomContext.js';
import type { RoomStatus } from '../controller/room.js';
import { useRoomConnection } from '../controller/use-room-connection.js';
import { cancelRoom } from '../network/rooms-api.js';
import { CopyInviteButton } from '../rooms/CopyInviteButton.js';
import { useGameStore } from '../store/store.js';
import { GameLayout } from './GameLayout.js';
import { paths } from './paths.js';

const PRESENCE_DOT: Record<OpponentPresence['status'], string> = {
  empty: 'bg-muted-foreground/40',
  connected: 'bg-emerald-500',
  disconnected: 'bg-amber-500',
};

const PresenceBadge = ({ opponent }: { opponent: OpponentPresence }) => (
  <span className="inline-flex items-center gap-1.5">
    <span className={`inline-block size-2 rounded-full ${PRESENCE_DOT[opponent.status]}`} />
    {opponent.status === 'empty' ? (
      <span>Waiting for opponent…</span>
    ) : (
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
    )}
  </span>
);

// A presenceUpdate can only arrive over the socket that is currently down, so
// while reconnecting the last reading of the opponent is unverifiable. Report
// our own connection rather than that stale reading.
const ConnectionBadge = ({
  status,
  opponent,
}: { status: RoomStatus; opponent: OpponentPresence }) =>
  status === 'reconnecting' ? (
    <span className="inline-flex items-center gap-1.5 text-amber-600">
      <span className="inline-block size-2 animate-pulse rounded-full bg-amber-500" />
      <span>Reconnecting…</span>
    </span>
  ) : (
    <PresenceBadge opponent={opponent} />
  );

export const PlayPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const room = useRoomConnection(roomId);
  const queryClient = useQueryClient();
  const [showQuitDialog, setShowQuitDialog] = useState(false);
  const gameStatus = useGameStore((s) => s.liveGame.status);

  // Nobody has taken the other seat, so there is no game to lose: the room is
  // cancelled outright rather than resigned. Presence only means that once the
  // handshake has answered; before it, 'empty' is just the initial reading.
  const alone = room.status === 'in-room' && room.opponent.status === 'empty';

  const handleConfirmQuit = (): void => {
    setShowQuitDialog(false);
    if (roomId === undefined) return;
    if (!alone) {
      // The room survives a resignation, so this stays on the finished board.
      room.resign();
      return;
    }
    void cancelRoom(roomId)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ['rooms'] });
        void navigate(paths.lobby, { viewTransition: true });
      })
      .catch((err: unknown) => {
        toast.error(err instanceof Error ? err.message : 'Could not cancel the game');
      });
  };

  useEffect(() => {
    if (room.status !== 'error') return;
    toast.error(room.errorMsg ?? 'Unknown error');
    void navigate(paths.lobby, { viewTransition: true });
  }, [room.status, room.errorMsg, navigate]);

  if (room.status === 'error') return null;
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
            <span className="flex items-center gap-3">
              <CopyInviteButton />
              <ConnectionBadge status={room.status} opponent={room.opponent} />
            </span>
            {!gameOver && (
              <Button
                variant="ghost"
                size="sm"
                disabled={room.status !== 'in-room'}
                onClick={() => setShowQuitDialog(true)}
              >
                {alone ? 'Cancel game' : 'Resign'}
              </Button>
            )}
          </div>
          <GameLayout />
        </div>
        <AlertDialog open={showQuitDialog} onOpenChange={setShowQuitDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{alone ? 'Cancel game?' : 'Resign?'}</AlertDialogTitle>
              <AlertDialogDescription>
                {alone
                  ? 'Nobody has joined yet, so the room is closed and nothing is recorded.'
                  : 'Resigning loses the game. The final position stays here for both of you to look at. To take a break instead, navigate away and re-open this URL to come back.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep playing</AlertDialogCancel>
              <AlertDialogAction onClick={handleConfirmQuit}>
                {alone ? 'Cancel game' : 'Resign'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </InputProvider>
    </RoomProvider>
  );
};
