import type { Color, GameState } from '@termitary/engine';
import { useEffect } from 'react';
import { useRoomContext } from '../controller/RoomContext.js';
import { notifier } from '../lib/notify.js';
import { paths } from '../routes/paths.js';
import { gameStore } from '../store/store.js';

const COLOR_LABEL: Record<Color, string> = { white: 'White', black: 'Black' };
const OTHER: Record<Color, Color> = { white: 'black', black: 'white' };

const moverAt = (index: number): Color => (index % 2 === 0 ? 'white' : 'black');

// The engine appends a forced pass to the move that caused it, so a pass that
// just happened arrives as exactly two new entries. A room loading in one jump
// does not, which keeps an old pass from toasting again.
// A finished game has nobody left to move again.
const justPassed = (next: GameState, prev: GameState): Color | null => {
  const { history } = next;
  if (next.status !== 'in_progress' || history.length !== prev.history.length + 2) return null;
  return history.at(-1)?.kind === 'pass' ? moverAt(history.length - 1) : null;
};

// A new tab: leaving the board drops the room's socket, or ends a hot-seat game.
const openPassingRules = (): void => {
  window.open(`${paths.rules}#passing`, '_blank', 'noreferrer');
};

/** Online only your own pass is news; hot-seat announces either. */
export const usePassToast = (): void => {
  const { myColor, opponent } = useRoomContext();

  useEffect(
    () =>
      gameStore.subscribe((state, prev) => {
        if (state.liveGame === prev.liveGame) return;
        const passed = justPassed(state.liveGame, prev.liveGame);
        if (passed === null || (myColor !== null && passed !== myColor)) return;

        const hotseat = myColor === null;
        const next = hotseat ? COLOR_LABEL[OTHER[passed]] : (opponent?.name ?? 'Your opponent');
        notifier.info(
          hotseat ? `${COLOR_LABEL[passed]} had no legal move` : 'You had no legal move',
          {
            id: 'forced-pass',
            description: `The turn passed, so ${next} moves again.`,
            duration: 8000,
            action: { label: 'Why?', onClick: openPassingRules },
          },
        );
      }),
    [myColor, opponent],
  );
};
