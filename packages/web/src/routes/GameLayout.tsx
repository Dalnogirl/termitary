import { BoardCanvas } from '../board/BoardCanvas.js';
import { Modal } from '../game-over/Modal.js';
import { Hand } from '../hand/Hand.js';
import { History } from '../history/History.js';
import { ReplayBanner } from '../history/ReplayBanner.js';
import { useHistoryKeys } from '../history/use-history-keys.js';

type Props = {
  /** Off when the result is already the reason you opened the page. */
  readonly showGameOver?: boolean;
  readonly returnLabel?: string;
};

export const GameLayout = ({ showGameOver = true, returnLabel }: Props) => {
  useHistoryKeys();

  return (
    <div className="flex flex-1 min-h-0">
      <div className="relative flex-1 min-w-0">
        <BoardCanvas />
        <Hand color="black" edge="top" />
        <Hand color="white" edge="bottom" />
        <ReplayBanner {...(returnLabel === undefined ? {} : { returnLabel })} />
      </div>
      <History />
      {showGameOver && <Modal />}
    </div>
  );
};
