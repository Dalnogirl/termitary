import { cn } from '@/lib/utils';
import type { RulesSection } from './chapters.js';

type Props = {
  readonly sections: readonly RulesSection[];
  readonly active: string;
  readonly onJump: (anchorId: string, chapterId: string) => void;
};

export const RulesNav = ({ sections, active, onJump }: Props) => (
  <nav aria-label="Rules sections" className="flex gap-1 rounded-xl bg-foreground/5 p-1">
    {sections.map(({ id, title, chapters }) => {
      const current = chapters.some(({ id }) => id === active);
      return (
        <button
          key={title}
          type="button"
          aria-current={current ? 'location' : undefined}
          onClick={() => onJump(id, chapters[0].id)}
          className={cn(
            'flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
            current
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {title}
        </button>
      );
    })}
  </nav>
);
