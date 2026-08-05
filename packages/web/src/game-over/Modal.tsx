import { useSyncExternalStore } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getState, reset, subscribe } from '../store/store.js';

type FinishedResult = 'white-wins' | 'black-wins' | 'draw';

const RESULT_TEXT: Record<FinishedResult, { title: string; subtitle: string }> = {
  'white-wins': { title: 'White wins', subtitle: 'Black queen surrounded' },
  'black-wins': { title: 'Black wins', subtitle: 'White queen surrounded' },
  draw: { title: 'Draw', subtitle: 'Both queens surrounded simultaneously' },
};

const useStore = () => useSyncExternalStore(subscribe, getState, getState);

export const Modal = () => {
  const state = useStore();
  if (state.game.status !== 'finished') return null;

  const { title, subtitle } = RESULT_TEXT[state.game.result];

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
