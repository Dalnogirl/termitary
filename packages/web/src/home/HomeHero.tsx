import type { ReactNode } from 'react';
import { DemoBoard } from './DemoBoard.js';

// The hero stops short of the viewport so the rule cards below show they exist.
export const HomeHero = ({ children }: { readonly children: ReactNode }) => (
  <section className="relative h-[min(70vh,560px)] w-full shrink-0 overflow-hidden border-b border-border">
    <DemoBoard />
    <div className="pointer-events-none absolute inset-0 flex items-end p-4 md:items-center md:p-10">
      <div className="glass-island pointer-events-auto flex w-full max-w-md flex-col gap-4 rounded-2xl p-6">
        {children}
      </div>
    </div>
  </section>
);
