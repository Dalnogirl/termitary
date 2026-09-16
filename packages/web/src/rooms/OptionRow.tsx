import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

type Props = {
  readonly control: 'radio' | 'checkbox';
  readonly group: string;
  readonly value: string;
  readonly selected: boolean;
  readonly glyph: ReactNode;
  readonly name: string;
  readonly note: string;
  readonly onSelect: () => void;
};

// The input is rendered here rather than passed in: a label needs its control
// as a descendant, and biome's a11y rule cannot see one arriving as a prop.
export const OptionRow = ({
  control,
  group,
  value,
  selected,
  glyph,
  name,
  note,
  onSelect,
}: Props) => (
  <label
    className={cn(
      'flex w-full items-center gap-3 rounded-lg border p-3 text-left cursor-pointer',
      'transition-colors focus-within:ring-2 focus-within:ring-foreground/30',
      selected ? 'border-foreground bg-muted/50' : 'border-border hover:bg-muted/30',
    )}
  >
    <input
      type={control}
      name={group}
      value={value}
      checked={selected}
      onChange={onSelect}
      className="sr-only"
    />
    <span
      className={cn('flex shrink-0 transition-opacity', selected ? 'opacity-100' : 'opacity-45')}
    >
      {glyph}
    </span>
    <span className="flex flex-col gap-1">
      <span className="text-sm font-medium">{name}</span>
      <span className="text-xs text-muted-foreground">{note}</span>
    </span>
  </label>
);
