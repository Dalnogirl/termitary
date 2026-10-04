import { type RefObject, useCallback, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const CHAPTER_ATTR = 'data-chapter';

export const chapterAttrs = (id: string) => ({ id, [CHAPTER_ATTR]: id });

// A section's first chapter takes its heading along, as a nav tab would.
const anchorOf = (chapterId: string): string => {
  const chapter = document.getElementById(chapterId);
  const opensSection = chapter?.previousElementSibling?.hasAttribute(CHAPTER_ATTR) === false;
  return (opensSection && chapter?.parentElement?.id) || chapterId;
};

// Moves the column alone, so the window never scrolls with it.
const alignToTop = (scroller: HTMLElement, anchorId: string): void => {
  const anchor = document.getElementById(anchorId);
  if (anchor === null) return;
  scroller.scrollTop += anchor.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
};

export type ActiveChapter = {
  /** The chapter that owns the board. */
  readonly active: string;
  /** Hands a chapter the board. The reader just clicked it, so nothing scrolls. */
  readonly select: (id: string) => void;
  /** Hands a chapter the board with its section's heading at the top of the column. */
  readonly jump: (anchorId: string, chapterId: string) => void;
};

/**
 * The chapter that owns the board, kept in the URL hash so it can be linked to.
 * Only a click or a nav tab changes it; scrolling the captions leaves it alone.
 */
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

  // Only the hash the page was opened with is scrolled to; later ones are ours.
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount only
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller !== null && hash.slice(1) === active) alignToTop(scroller, anchorOf(active));
  }, []);

  useEffect(() => {
    if (hash.slice(1) === active) return;
    void navigate({ hash: `#${active}` }, { replace: true, preventScrollReset: true });
  }, [active, hash, navigate]);

  const jump = useCallback(
    (anchorId: string, chapterId: string) => {
      const scroller = scrollerRef.current;
      if (scroller !== null) alignToTop(scroller, anchorId);
      setActive(chapterId);
    },
    [scrollerRef],
  );

  return { active, select: setActive, jump };
};
