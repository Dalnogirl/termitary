import { cn } from '@/lib/utils';
import { DemoControls } from './DemoControls.js';
import type { RulesDemo } from './demo.js';
import { chapterAttrs } from './use-active-chapter.js';

type Props = {
  readonly demo: RulesDemo;
  readonly active: boolean;
  readonly onSelect: () => void;
};

// A drag that selects caption text still ends in a click.
const selectUnlessSelectingText = (onSelect: () => void) => (): void => {
  if (window.getSelection()?.isCollapsed === false) return;
  onSelect();
};

// The title button gives keyboards a way in; its click bubbles to the section like any other.
export const Chapter = ({ demo, active, onSelect }: Props) => (
  <section
    {...chapterAttrs(demo.id)}
    onClick={active ? undefined : selectUnlessSelectingText(onSelect)}
    className={cn(
      'flex flex-col gap-3 py-8 transition-opacity',
      !active && 'cursor-pointer opacity-50 hover:opacity-75',
    )}
  >
    <h2 className="text-lg font-semibold">
      {/* Stays a button once active, or activating it from the keyboard drops focus. */}
      <button
        type="button"
        aria-current={active ? 'step' : undefined}
        className={cn(active && 'cursor-default')}
      >
        {demo.title}
      </button>
    </h2>
    <p className="text-sm leading-relaxed text-muted-foreground">{demo.caption}</p>
    <div className="min-h-8">{active && <DemoControls demo={demo} />}</div>
  </section>
);
