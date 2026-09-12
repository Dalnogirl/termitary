import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useGameStore } from '../store/store.js';

type FinishedResult = 'white-wins' | 'black-wins' | 'draw';

const RESULT_TEXT: Record<FinishedResult, { title: string; subtitle: string }> = {
  'white-wins': { title: 'White wins', subtitle: 'Black queen surrounded' },
  'black-wins': { title: 'Black wins', subtitle: 'White queen surrounded' },
  draw: { title: 'Draw', subtitle: 'Both queens surrounded simultaneously' },
};

export const Modal = () => {
  const game = useGameStore((s) => s.liveGame);
  const reset = useGameStore((s) => s.reset);
  if (game.status !== 'finished') return null;

  const { title, subtitle } = RESULT_TEXT[game.result];

  return (
    <AlertDialog open>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{subtitle}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={reset}>New game</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
