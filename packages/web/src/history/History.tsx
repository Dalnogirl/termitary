import { cn } from '@/lib/utils';
import type { HexCoord, Move, PieceType } from '@termitary/engine';
import { ChevronLeft, ChevronRight, ListOrdered } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useGameStore } from '../store/store.js';

const PIECE_NAME: Record<PieceType, string> = {
  queen: 'Queen',
  ant: 'Ant',
  beetle: 'Beetle',
  spider: 'Spider',
  grasshopper: 'Grasshopper',
  ladybug: 'Ladybug',
  mosquito: 'Mosquito',
  pillbug: 'Pillbug',
};

const formatCoord = (c: HexCoord): string => `(${c.q},${c.r})`;

export const formatMove = (move: Move): string => {
  switch (move.kind) {
    case 'place':
      return `placed ${PIECE_NAME[move.piece.type]} at ${formatCoord(move.to)}`;
    case 'relocate':
      return `moved ${formatCoord(move.from)} → ${formatCoord(move.to)}`;
    // The thrower is a cell rather than a piece name: a mosquito beside a
    // pillbug will throw too, and the history has no board to look either up in.
    case 'throw':
      return `${formatCoord(move.by)} threw ${formatCoord(move.from)} → ${formatCoord(move.to)}`;
    case 'pass':
      return 'passed';
  }
};

// Initial state mirrors viewport: open on desktop, closed on mobile. matchMedia
// is safe — no SSR (Vite client app). Resize after mount does not auto-toggle;
// the responsive layout classes still adapt the open drawer.
const initialOpen = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

export const History = () => {
  const history = useGameStore((s) => s.liveGame.history);
  const viewIndex = useGameStore((s) => s.viewIndex);
  const setViewIndex = useGameStore((s) => s.setViewIndex);
  const [isOpen, setIsOpen] = useState(initialOpen);
  const closeRef = useRef<HTMLButtonElement>(null);
  const activeRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (!isOpen || viewIndex === 0) return;
    activeRef.current?.scrollIntoView({ block: 'nearest' });
  }, [isOpen, viewIndex]);

  useEffect(() => {
    if (!isOpen) return;
    closeRef.current?.focus();
  }, [isOpen]);

  if (!isOpen) {
    return (
      <>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open history"
          className="hidden md:flex w-8 border-l border-border bg-card items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <ChevronLeft className="size-4" />
        </button>
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open history"
          className="md:hidden fixed bottom-24 right-4 z-30 w-12 h-12 rounded-full glass-island flex items-center justify-center text-foreground"
        >
          <ListOrdered className="size-5" />
        </button>
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close history"
        tabIndex={-1}
        onClick={() => setIsOpen(false)}
        className="md:hidden fixed inset-0 bg-black/40 z-30 cursor-default"
      />
      <aside
        className={cn(
          'flex flex-col w-60 border-l border-border bg-card overflow-hidden',
          'max-md:fixed max-md:inset-y-0 max-md:right-0 max-md:w-72 max-md:z-40 max-md:shadow-lg',
        )}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground font-semibold">
            History
          </span>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Close history"
            className="text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className="size-4" />
          </button>
        </header>
        {history.length === 0 ? (
          <p className="px-4 py-3 text-muted-foreground text-xs italic">No moves yet.</p>
        ) : (
          <ol className="flex-1 overflow-y-auto list-none m-0 p-0 font-mono text-xs">
            {history.map((move, idx) => {
              const turn = Math.floor(idx / 2) + 1;
              const player = idx % 2 === 0 ? 'White' : 'Black';
              const isActive = viewIndex === idx + 1;
              return (
                <li
                  // Move history is append-only — idx IS the canonical move ordinal.
                  // biome-ignore lint/suspicious/noArrayIndexKey: append-only list
                  key={idx}
                  ref={isActive ? activeRef : null}
                  className="border-b border-border/50"
                >
                  <button
                    type="button"
                    onClick={() => setViewIndex(idx + 1)}
                    aria-current={isActive}
                    className={cn(
                      'flex w-full gap-2 px-4 py-1.5 text-left hover:bg-muted/50',
                      isActive && 'bg-muted',
                    )}
                  >
                    <span className="text-muted-foreground w-6 shrink-0">{turn}.</span>
                    <span className="font-semibold w-12 shrink-0">{player}</span>
                    <span className="text-foreground/80">{formatMove(move)}</span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    </>
  );
};
