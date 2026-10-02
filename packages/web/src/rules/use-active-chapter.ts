import { type RefObject, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

const CHAPTER_ATTR = 'data-chapter';

export const chapterAttrs = (id: string) => ({ id, [CHAPTER_ATTR]: id });

// The ends win outright: the first chapter's middle sits above the viewport's at
// the top of the page, and the last one's can never scroll up to reach it.
const nearestMiddle = (scroller: HTMLElement): string | null => {
  const sections = [...scroller.querySelectorAll<HTMLElement>(`[${CHAPTER_ATTR}]`)];
  if (scroller.scrollTop <= 0) return sections[0]?.id ?? null;
  if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) {
    return sections.at(-1)?.id ?? null;
  }

  const frame = scroller.getBoundingClientRect();
  const middle = frame.top + frame.height / 2;
  let best: { id: string; distance: number } | null = null;
  for (const section of sections) {
    const box = section.getBoundingClientRect();
    const distance = Math.abs(box.top + box.height / 2 - middle);
    if (best === null || distance < best.distance) best = { id: section.id, distance };
  }
  return best?.id ?? null;
};

/** The chapter that owns the board, kept in the URL hash so it can be linked to. */
export const useActiveChapter = (
  scrollerRef: RefObject<HTMLElement | null>,
  chapters: readonly [{ readonly id: string }, ...{ readonly id: string }[]],
): string => {
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
    if (scroller === null) return;

    // A linked chapter that cannot reach the middle would lose to its neighbour
    // on the scroll that brought it into view, so it holds until the reader scrolls.
    const linked = document.getElementById(active);
    let holding = linked !== null && hash.slice(1) === active;
    linked?.scrollIntoView({ block: 'center' });
    const release = (): void => {
      holding = false;
    };
    const intents = ['wheel', 'touchstart', 'keydown', 'pointerdown'] as const;
    for (const intent of intents) scroller.addEventListener(intent, release, { passive: true });

    let frame: number | undefined;
    const onScroll = (): void => {
      if (holding || frame !== undefined) return;
      frame = requestAnimationFrame(() => {
        frame = undefined;
        const id = nearestMiddle(scroller);
        if (id !== null) setActive(id);
      });
    };

    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      for (const intent of intents) scroller.removeEventListener(intent, release);
      scroller.removeEventListener('scroll', onScroll);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    if (hash.slice(1) === active) return;
    void navigate({ hash: `#${active}` }, { replace: true, preventScrollReset: true });
  }, [active, hash, navigate]);

  return active;
};
