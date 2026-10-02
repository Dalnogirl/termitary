import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const CHAPTER_ATTR = 'data-chapter';

export const chapterAttrs = (id: string) => ({ id, [CHAPTER_ATTR]: id });

// The focus line slides from the column's top to its bottom as the reader scrolls,
// so every chapter takes the board on the way down without padding the column.
const scrollProgress = (scroller: HTMLElement): number => {
  const range = scroller.scrollHeight - scroller.clientHeight;
  return range > 0 ? scroller.scrollTop / range : 0;
};

const sectionsOf = (scroller: HTMLElement): HTMLElement[] => [
  ...scroller.querySelectorAll<HTMLElement>(`[${CHAPTER_ATTR}]`),
];

const underFocus = (scroller: HTMLElement): string | null => {
  const frame = scroller.getBoundingClientRect();
  const line = frame.top + scrollProgress(scroller) * frame.height;
  let best: { id: string; distance: number } | null = null;
  for (const section of sectionsOf(scroller)) {
    const box = section.getBoundingClientRect();
    const distance = Math.max(box.top - line, line - box.bottom, 0);
    if (best === null || distance < best.distance) best = { id: section.id, distance };
  }
  return best?.id ?? null;
};

// Moves the focus line onto the chapter's middle, unless it already sits in the
// chapter, so the first one stays at the top. True when the column moved.
const bringUnderFocus = (scroller: HTMLElement, id: string): boolean => {
  const section = document.getElementById(id);
  if (section === null || underFocus(scroller) === id) return false;
  const frame = scroller.getBoundingClientRect();
  const box = section.getBoundingClientRect();
  const middle = box.top - frame.top + scroller.scrollTop + box.height / 2;
  const range = scroller.scrollHeight - scroller.clientHeight;
  const before = scroller.scrollTop;
  scroller.scrollTop = (middle * range) / scroller.scrollHeight;
  return scroller.scrollTop !== before;
};

export type ActiveChapter = {
  /** The chapter that owns the board. */
  readonly active: string;
  /** Hands a chapter the board and scrolls to where scrolling would have. */
  readonly select: (id: string) => void;
};

/** The chapter that owns the board, kept in the URL hash so it can be linked to. */
export const useActiveChapter = (
  scrollerRef: RefObject<HTMLElement | null>,
  chapters: readonly [{ readonly id: string }, ...{ readonly id: string }[]],
): ActiveChapter => {
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState(() => {
    const linked = hash.slice(1);
    return chapters.some(({ id }) => id === linked) ? linked : chapters[0].id;
  });
  // Our own scroll lands on whole pixels, which can tip the line into a neighbour
  // when the column barely overflows, so the chapter we chose stands.
  const steering = useRef(false);
  const steer = useCallback((scroller: HTMLElement, id: string): void => {
    if (bringUnderFocus(scroller, id)) steering.current = true;
  }, []);

  // Only the hash the page was opened with is scrolled to; later ones are ours.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller === null) return;
    steer(scroller, active);

    let frame: number | undefined;
    const onScroll = (): void => {
      if (frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        if (steering.current) {
          steering.current = false;
          return;
        }
        const id = underFocus(scroller);
        if (id !== null) setActive(id);
      });
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (hash.slice(1) === active) return;
    void navigate({ hash: `#${active}` }, { replace: true, preventScrollReset: true });
  }, [active, hash, navigate]);

  // Set directly as well, since a column that fits the screen scrolls nowhere.
  const select = useCallback(
    (id: string) => {
      const scroller = scrollerRef.current;
      if (scroller !== null) steer(scroller, id);
      setActive(id);
    },
    [scrollerRef, steer],
  );

  return { active, select };
};
