import type { Color } from '@termitary/engine';
import type { ReactNode } from 'react';
import { BoardCanvas } from '../board/BoardCanvas.js';
import { Modal } from '../game-over/Modal.js';
import { Hand } from '../hand/Hand.js';
import { History } from '../history/History.js';
import { ReplayBanner } from '../history/ReplayBanner.js';
import { useHistoryKeys } from '../history/use-history-keys.js';
import { useReplayFailedToast } from '../history/use-replay-failed-toast.js';
import { usePassToast } from '../pass-notice/use-pass-toast.js';

type Props = {
  /** Off when the result is already the reason you opened the page. */
  readonly showGameOver?: boolean;
  readonly returnLabel?: string;
  /** Each side's clock, shown in its hand. Only a room has one. */
  readonly clocks?: Readonly<Record<Color, ReactNode>>;
};

export const GameLayout = ({ showGameOver = true, returnLabel, clocks }: Props) => {
  useHistoryKeys();
  useReplayFailedToast();
  usePassToast();

  return (
    <div className="flex flex-1 min-h-0">
      <div className="relative flex-1 min-w-0">
        <BoardCanvas />
        <Hand color="black" edge="top" clock={clocks?.black} />
        <Hand color="white" edge="bottom" clock={clocks?.white} />
        <ReplayBanner {...(returnLabel === undefined ? {} : { returnLabel })} />
      </div>
      <History />
      {showGameOver && <Modal />}
    </div>
  );
};
