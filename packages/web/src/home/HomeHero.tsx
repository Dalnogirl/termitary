import type { ReactNode } from 'react';
import { DemoBoard } from './DemoBoard.js';

type Props = {
  // Signed out the hero stops short so the rule cards below show they exist.
  // Signed in there is nothing below, so it takes the whole viewport.
  readonly height: 'partial' | 'full';
  readonly children: ReactNode;
};

const HEIGHTS: Record<Props['height'], string> = {
  partial: 'h-[min(70vh,560px)] shrink-0',
  full: 'flex-1 min-h-0',
};

export const HomeHero = ({ height, children }: Props) => (
  <section className={`relative w-full overflow-hidden border-b border-border ${HEIGHTS[height]}`}>
    <DemoBoard />
    <div className="pointer-events-none absolute inset-0 flex items-end p-4 md:items-center md:p-10">
      <div className="glass-island pointer-events-auto flex w-full max-w-md flex-col gap-4 rounded-2xl p-6">
        {children}
      </div>
    </div>
  </section>
);
