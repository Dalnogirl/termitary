import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { CreateRoomRequestDto, SeatChoice } from '@termitary/protocol';
import { type FormEvent, useState } from 'react';
import { usePrefsStore } from '../store/prefs.js';
import { ExpansionPicker } from './ExpansionPicker.js';
import { SeatPicker } from './SeatPicker.js';
import { type ExpansionPiece, rulesetFor } from './expansions.js';

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
          <SeatPicker seat={seat} onPick={setSeat} />
          <ExpansionPicker picked={expansions} onToggle={toggle} />
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create game'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
