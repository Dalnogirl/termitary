import { useMemo, useRef } from 'react';
import { BoardCanvas } from '../board/BoardCanvas.js';
import { InputProvider } from '../controller/InputProvider.js';
import { RoomProvider } from '../controller/RoomContext.js';
import { createLocalController } from '../controller/local.js';
import { Hand } from '../hand/Hand.js';
import { notifier } from '../lib/notify.js';
import { Chapter } from '../rules/Chapter.js';
import { CHAPTERS } from '../rules/chapters.js';
import { useActiveChapter } from '../rules/use-active-chapter.js';

export const RulesPage = () => {
  const controller = useMemo(() => createLocalController({ notifier }), []);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { active, select } = useActiveChapter(scrollerRef, CHAPTERS);

  return (
    <RoomProvider myColor={null}>
      <InputProvider controller={controller}>
        <div className="flex flex-1 min-h-0 flex-col md:flex-row-reverse">
          <div className="relative h-[50dvh] shrink-0 border-b border-border md:h-auto md:flex-1 md:border-b-0 md:border-l">
            <BoardCanvas />
            <Hand color="black" edge="top" />
            <Hand color="white" edge="bottom" />
          </div>
          <div
            ref={scrollerRef}
            className="flex-1 min-h-0 overflow-y-auto px-5 md:w-md md:flex-none md:px-8"
          >
            <h1 className="pt-6 text-2xl font-semibold">How to play</h1>
            {CHAPTERS.map((demo) => (
              <Chapter
                key={demo.id}
                demo={demo}
                active={demo.id === active}
                onSelect={() => select(demo.id)}
              />
            ))}
          </div>
        </div>
      </InputProvider>
    </RoomProvider>
  );
};
