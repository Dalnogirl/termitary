import type { ReactNode } from 'react';

export const Badge = ({ children }: { readonly children: ReactNode }) => (
  <span className="rounded-full border border-border px-2 py-0.5 text-[0.65rem] uppercase tracking-wide text-muted-foreground">
    {children}
  </span>
);
