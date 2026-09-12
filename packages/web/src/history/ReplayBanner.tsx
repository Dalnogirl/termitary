import { useGameStore } from '../store/store.js';

type Props = {
  readonly returnLabel?: string;
};

export const ReplayBanner = ({ returnLabel = 'Back to live' }: Props) => {
  const viewIndex = useGameStore((s) => s.viewIndex);
  const moveCount = useGameStore((s) => s.liveGame.history.length);
  const returnToLive = useGameStore((s) => s.returnToLive);

  if (viewIndex === moveCount) return null;

  return (
    <div className="absolute top-3 left-3 z-20 glass-island flex items-center gap-3 rounded-full px-3 py-1.5 text-xs">
      <span className="text-muted-foreground">
        Move <span className="font-mono text-foreground">{viewIndex}</span> of {moveCount}
      </span>
      <button
        type="button"
        onClick={returnToLive}
        className="font-semibold text-foreground hover:underline"
      >
        {returnLabel}
      </button>
    </div>
  );
};
