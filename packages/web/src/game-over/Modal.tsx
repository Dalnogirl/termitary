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
import type { Color, EndReason } from '@termitary/engine';
import type { OpponentPresence } from '@termitary/protocol';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
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

const WINNING_COLOR: Record<FinishedResult, Color | null> = {
  'white-wins': 'white',
  'black-wins': 'black',
  draw: null,
};

// Hot-seat has no "you", so it keeps the colours. Online, one of the two seats
// is yours and the other is the opponent the room handed us, so both are
// nameable without the server telling us our own name.
const Title = ({
  result,
  myColor,
  opponent,
}: { result: FinishedResult; myColor: Color | null; opponent: OpponentPresence }) => {
  const winner = WINNING_COLOR[result];
  if (myColor === null || winner === null) return <>{TITLE[result]}</>;
  if (winner === myColor) return <>You win</>;
  if (opponent.status === 'empty') return <>{TITLE[result]}</>;
  return (
    <>
      <Link to={paths.profile(opponent.userId)} className="no-underline hover:underline">
        {opponent.name}
      </Link>{' '}
      wins
    </>
  );
};

export const Modal = () => {
  const game = useGameStore((s) => s.liveGame);
  const reset = useGameStore((s) => s.reset);
  const { myColor, opponent } = useRoomContext();
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
          <AlertDialogTitle>
            <Title result={game.result} myColor={myColor} opponent={opponent} />
          </AlertDialogTitle>
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
