import { type RefObject, useEffect, useRef, useState } from 'react';

// Initial state mirrors viewport: open on desktop, closed on mobile. matchMedia
// is safe: no SSR (Vite client app). Resize after mount does not auto-toggle;
// the responsive layout classes still adapt the open drawer.
const initialOpen = (): boolean =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

export type HistoryPanel = {
  readonly isOpen: boolean;
  readonly open: () => void;
  readonly close: () => void;
  /** Takes focus each time the panel opens. */
  readonly closeRef: RefObject<HTMLButtonElement | null>;
  /** The row for `viewIndex`, kept scrolled into view while the panel is open. */
  readonly activeRef: RefObject<HTMLLIElement | null>;
};

export const useHistoryPanel = (viewIndex: number): HistoryPanel => {
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

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    closeRef,
    activeRef,
  };
};
