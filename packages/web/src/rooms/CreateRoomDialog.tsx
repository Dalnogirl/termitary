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
import type { SeatChoice } from '@termitary/protocol';
import { type FormEvent, useState } from 'react';

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
  readonly onCreate: (seat: SeatChoice) => Promise<boolean>;
};

export const CreateRoomDialog = ({
  triggerLabel,
  triggerSize = 'default',
  isPending,
  onCreate,
}: Props) => {
  const [open, setOpen] = useState(false);
  const [seat, setSeat] = useState<SeatChoice>('random');

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    // Closed before the caller navigates, so the dialog is gone from the
    // outgoing view transition rather than cross-fading with the page.
    void onCreate(seat).then((created) => {
      if (created) setOpen(false);
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
          <DialogDescription>Pick your seat. Whoever joins takes the other one.</DialogDescription>
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
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create game'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
