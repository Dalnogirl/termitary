import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { Color, PieceType } from '@termitary/engine';
import type { CreateRoomRequestDto, SeatChoice } from '@termitary/protocol';
import { type FormEvent, type ReactNode, useState } from 'react';
import { PieceMark } from '../board/PieceMark.js';
import { usePrefsStore } from '../store/prefs.js';
import { EXPANSIONS, type ExpansionPiece, rulesetFor } from './expansions.js';

const SEATS: readonly {
  readonly value: SeatChoice;
  readonly name: string;
  readonly note: string;
}[] = [
  { value: 'white', name: 'White', note: 'You move first.' },
  { value: 'black', name: 'Black', note: 'Your opponent opens.' },
  { value: 'random', name: 'Random', note: 'Decided now, before anyone joins.' },
];

const tileClass: Record<Color, string> = {
  white: 'bg-(--piece-white-fill)',
  black: 'bg-(--piece-black-fill) border border-border',
};

const Tile = ({
  type,
  color,
  half = false,
}: {
  readonly type: PieceType;
  readonly color: Color;
  /** Two of these side by side take the width of one whole tile. */
  readonly half?: boolean;
}) => (
  <span
    aria-hidden="true"
    className={cn(
      'inline-flex items-center justify-center rounded-lg',
      half ? 'size-6' : 'size-9',
      tileClass[color],
    )}
  >
    <PieceMark type={type} color={color} size={half ? 18 : 30} />
  </span>
);

// Random overlaps its two tiles by half, so every row starts its text in the
// same column whichever seat it offers.
const SEAT_GLYPH: Record<SeatChoice, ReactNode> = {
  white: <Tile type="queen" color="white" />,
  black: <Tile type="queen" color="black" />,
  random: (
    <span className="flex items-center">
      <Tile type="queen" color="white" half />
      <span className="-ml-3">
        <Tile type="queen" color="black" half />
      </span>
    </span>
  ),
};

const OptionRow = ({
  control,
  group,
  value,
  selected,
  glyph,
  name,
  note,
  onSelect,
}: {
  readonly control: 'radio' | 'checkbox';
  readonly group: string;
  readonly value: string;
  readonly selected: boolean;
  readonly glyph: ReactNode;
  readonly name: string;
  readonly note: string;
  readonly onSelect: () => void;
}) => (
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

type Props = {
  readonly triggerLabel: string;
  readonly triggerSize?: 'default' | 'lg';
  readonly isPending: boolean;
  /** Resolves false when the create failed, which keeps the dialog open. */
  readonly onCreate: (request: CreateRoomRequestDto) => Promise<boolean>;
};

export const CreateRoomDialog = ({
  triggerLabel,
  triggerSize = 'default',
  isPending,
  onCreate,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [seat, setSeat] = useState<SeatChoice>('random');
  const rememberedExpansions = usePrefsStore((s) => s.expansions);
  const setRememberedExpansions = usePrefsStore((s) => s.setExpansions);
  const [expansions, setExpansions] = useState<readonly ExpansionPiece[]>(rememberedExpansions);

  const toggle = (piece: ExpansionPiece): void =>
    setExpansions((picked) =>
      picked.includes(piece) ? picked.filter((p) => p !== piece) : [...picked, piece],
    );

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    // A base game sends no ruleset at all: absence is how the wire says base.
    const request: CreateRoomRequestDto =
      expansions.length === 0 ? { seat } : { seat, ruleset: rulesetFor(expansions) };
    // Closed before the caller navigates, so the dialog is gone from the
    // outgoing view transition rather than cross-fading with the page.
    void onCreate(request).then((created) => {
      if (!created) return;
      setRememberedExpansions(expansions);
      setOpen(false);
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={triggerSize}>{triggerLabel}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New game</DialogTitle>
          <DialogDescription>
            Pick your seat and the pieces. Whoever joins takes the other seat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <fieldset className="grid gap-2 border-0 p-0 m-0">
            <legend className="sr-only">Your seat</legend>
            {SEATS.map(({ value, name, note }) => (
              <OptionRow
                key={value}
                control="radio"
                group="seat"
                value={value}
                selected={seat === value}
                glyph={SEAT_GLYPH[value]}
                name={name}
                note={note}
                onSelect={() => setSeat(value)}
              />
            ))}
          </fieldset>
          <fieldset className="grid gap-2 border-0 p-0 m-0">
            <legend className="text-xs text-muted-foreground pb-2">Expansion pieces</legend>
            {EXPANSIONS.map(({ piece, label, note }) => (
              <OptionRow
                key={piece}
                control="checkbox"
                group="expansion"
                value={piece}
                selected={expansions.includes(piece)}
                glyph={<Tile type={piece} color="white" />}
                name={label}
                note={note}
                onSelect={() => toggle(piece)}
              />
            ))}
          </fieldset>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create game'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
