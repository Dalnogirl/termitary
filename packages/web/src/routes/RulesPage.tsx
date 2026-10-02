import { useMemo, useRef } from 'react';
import { BoardCanvas } from '../board/BoardCanvas.js';
import { InputProvider } from '../controller/InputProvider.js';
import { RoomProvider } from '../controller/RoomContext.js';
import { createLocalController } from '../controller/local.js';
import { Hand } from '../hand/Hand.js';
import { notifier } from '../lib/notify.js';
import { Chapter } from '../rules/Chapter.js';
import { RulesNav } from '../rules/RulesNav.js';
import { CHAPTERS, SECTIONS } from '../rules/chapters.js';
import { useActiveChapter } from '../rules/use-active-chapter.js';

// The panel floats over the board. The canvas runs on under it by the panel's
// own size, so the hive centres in the part of the board left uncovered.
export const RulesPage = () => {
  const controller = useMemo(() => createLocalController({ notifier }), []);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { active, select, jump } = useActiveChapter(scrollerRef, CHAPTERS);

  return (
    <RoomProvider myColor={null}>
      <InputProvider controller={controller}>
        <div className="relative flex-1 min-h-0 overflow-hidden [--panel-h:45dvh] [--panel-w:30rem] max-lg:[--panel-w:20rem]">
          <div className="absolute inset-0 -top-(--panel-h) side:top-0 side:-right-(--panel-w)">
            <BoardCanvas />
          </div>
          <div className="pointer-events-none absolute inset-0 bottom-(--panel-h) side:bottom-0 side:left-(--panel-w) [&>*]:pointer-events-auto">
            <Hand color="black" edge="top" />
            <Hand color="white" edge="bottom" />
          </div>
          <aside className="glass-island absolute inset-x-3 bottom-3 z-30 flex h-[calc(var(--panel-h)-1.5rem)] flex-col rounded-2xl side:inset-y-4 side:left-4 side:right-auto side:h-auto side:w-[calc(var(--panel-w)-2rem)]">
            <header className="flex flex-col gap-3 px-5 pt-4 pb-3 side:px-6 side:pt-6">
              <h1 className="text-2xl font-semibold sr-only lg:not-sr-only">How to play</h1>
              <RulesNav sections={SECTIONS} active={active} onJump={jump} />
            </header>
            <div
              ref={scrollerRef}
              className="scrollbar-quiet min-h-0 flex-1 overflow-y-auto px-5 side:px-6"
            >
              {SECTIONS.map(({ id, title, chapters }) => (
                <section key={id} id={id} className="pt-4">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                    {title}
                  </h2>
                  {chapters.map((demo) => (
                    <Chapter
                      key={demo.id}
                      demo={demo}
                      active={demo.id === active}
                      onSelect={() => select(demo.id)}
                    />
                  ))}
                </section>
              ))}
            </div>
          </aside>
        </div>
      </InputProvider>
    </RoomProvider>
  );
};
