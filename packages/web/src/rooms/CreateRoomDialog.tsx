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
import type { CreateRoomRequestDto, SeatChoice } from '@termitary/protocol';
import { type FormEvent, useState } from 'react';
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
              <label
                key={value}
                className={cn(
                  'flex w-full flex-col gap-1 rounded-lg border p-3 text-left cursor-pointer',
                  'transition-colors focus-within:ring-2 focus-within:ring-foreground/30',
                  seat === value
                    ? 'border-foreground bg-muted/50'
                    : 'border-border hover:bg-muted/30',
                )}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="seat"
                    value={value}
                    checked={seat === value}
                    onChange={() => setSeat(value)}
                    className="sr-only"
                  />
                  <span className="text-sm font-medium">{name}</span>
                </span>
                <span className="text-xs text-muted-foreground">{note}</span>
              </label>
            ))}
          </fieldset>
          <fieldset className="grid gap-2 border-0 p-0 m-0">
            <legend className="text-xs text-muted-foreground pb-2">Expansion pieces</legend>
            {EXPANSIONS.map(({ piece, label, note }) => (
              <label
                key={piece}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg border p-3 text-left cursor-pointer',
                  'transition-colors focus-within:ring-2 focus-within:ring-foreground/30',
                  expansions.includes(piece)
                    ? 'border-foreground bg-muted/50'
                    : 'border-border hover:bg-muted/30',
                )}
              >
                <input
                  type="checkbox"
                  name="expansion"
                  value={piece}
                  checked={expansions.includes(piece)}
                  onChange={() => toggle(piece)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    'inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--piece-white-fill)',
                    'transition-opacity',
                    expansions.includes(piece) ? 'opacity-100' : 'opacity-45',
                  )}
                >
                  <PieceMark type={piece} color="white" size={30} />
                </span>
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="text-xs text-muted-foreground">{note}</span>
                </span>
              </label>
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
