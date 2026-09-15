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
import type { EndReason } from '@termitary/engine';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useRoomContext } from '../controller/RoomContext.js';
import { paths } from '../routes/paths.js';
import { useGameStore } from '../store/store.js';

type FinishedResult = 'white-wins' | 'black-wins' | 'draw';

const TITLE: Record<FinishedResult, string> = {
  'white-wins': 'White wins',
  'black-wins': 'Black wins',
  draw: 'Draw',
};

const SURRENDER_SUBTITLE: Record<FinishedResult, string> = {
  'white-wins': 'Black resigned',
  'black-wins': 'White resigned',
  // Resigning always names a winner, so this is unreachable.
  draw: 'Game resigned',
};

const SURROUNDED_SUBTITLE: Record<FinishedResult, string> = {
  'white-wins': 'Black queen surrounded',
  'black-wins': 'White queen surrounded',
  draw: 'Both queens surrounded simultaneously',
};

const subtitleOf = (result: FinishedResult, endReason: EndReason): string =>
  endReason === 'resignation' ? SURRENDER_SUBTITLE[result] : SURROUNDED_SUBTITLE[result];

export const Modal = () => {
  const game = useGameStore((s) => s.liveGame);
  const reset = useGameStore((s) => s.reset);
  const { myColor } = useRoomContext();
  const navigate = useNavigate();
  // Lets the player read the result and then look at the board behind it. A
  // reconnect re-delivers the same finished game as a fresh object, so this
  // cannot key on identity; only a game going back in progress reopens it.
  const [dismissed, setDismissed] = useState(false);
  const finished = game.status === 'finished';
  useEffect(() => {
    if (!finished) setDismissed(false);
  }, [finished]);

  if (game.status !== 'finished') return null;

  const hotseat = myColor === null;

  return (
    <AlertDialog open={!dismissed}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{TITLE[game.result]}</AlertDialogTitle>
          <AlertDialogDescription>{subtitleOf(game.result, game.endReason)}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setDismissed(true)}>Review board</AlertDialogCancel>
          {hotseat ? (
            <AlertDialogAction onClick={reset}>New game</AlertDialogAction>
          ) : (
            <AlertDialogAction onClick={() => void navigate(paths.lobby)}>
              Back to lobby
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
