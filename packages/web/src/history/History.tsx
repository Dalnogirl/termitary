import type { HexCoord, Move, PieceType } from '@hive/engine';
import { useGameStore } from '../store/store.js';

const PIECE_NAME: Record<PieceType, string> = {
  queen: 'Queen',
  ant: 'Ant',
  beetle: 'Beetle',
  spider: 'Spider',
  grasshopper: 'Grasshopper',
};

const formatCoord = (c: HexCoord): string => `(${c.q},${c.r})`;

const formatMove = (move: Move): string => {
  switch (move.kind) {
    case 'place':
      return `placed ${PIECE_NAME[move.piece.type]} at ${formatCoord(move.to)}`;
    case 'relocate':
      return `moved ${formatCoord(move.from)} → ${formatCoord(move.to)}`;
    case 'pass':
      return 'passed';
  }
};

export const History = () => {
  const history = useGameStore((s) => s.game.history);

  return (
    <aside className="flex flex-col w-60 border-l border-border bg-card overflow-hidden">
      <header className="px-4 py-3 border-b border-border">
        <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-semibold">
          History
        </span>
      </header>
      {history.length === 0 ? (
        <p className="px-4 py-3 text-muted-foreground text-xs italic">No moves yet.</p>
      ) : (
        <ol className="flex-1 overflow-y-auto list-none m-0 p-0 font-mono text-xs">
          {history.map((move, idx) => {
            const turn = Math.floor(idx / 2) + 1;
            const player = idx % 2 === 0 ? 'White' : 'Black';
            return (
              <li
                // Move history is append-only — idx IS the canonical move ordinal.
                // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
                key={idx}
                className="flex gap-2 px-4 py-1.5 border-b border-border/50 hover:bg-muted/50"
              >
                <span className="text-muted-foreground w-6 shrink-0">{turn}.</span>
                <span className="font-semibold w-12 shrink-0">{player}</span>
                <span className="text-foreground/80">{formatMove(move)}</span>
              </li>
            );
          })}
        </ol>
      )}
    </aside>
  );
};
