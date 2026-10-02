import { cn } from '@/lib/utils';
import { DemoControls } from './DemoControls.js';
import type { RulesDemo } from './demo.js';
import { chapterAttrs } from './use-active-chapter.js';

type Props = {
  readonly demo: RulesDemo;
  readonly active: boolean;
};

export const Chapter = ({ demo, active }: Props) => (
  <section
    {...chapterAttrs(demo.id)}
    className={cn('flex flex-col gap-3 py-8 transition-opacity', !active && 'opacity-50')}
  >
    <h2 className="text-lg font-semibold">{demo.title}</h2>
    <p className="text-sm leading-relaxed text-muted-foreground">{demo.caption}</p>
    <div className="min-h-8">{active && <DemoControls demo={demo} />}</div>
  </section>
);
