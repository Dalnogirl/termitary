import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { type FormEvent, useState } from 'react';
import { ExpansionPicker } from '../rooms/ExpansionPicker.js';
import type { ExpansionPiece } from '../rooms/expansions.js';
import { usePrefsStore } from '../store/prefs.js';

type Props = {
  /** Open on arrival: the settings are the first thing the route asks about. */
  readonly defaultOpen?: boolean;
  readonly onStart: (expansions: readonly ExpansionPiece[]) => void;
};

// No seat picker: hot-seat plays both colours, so the only thing to choose is
// what is in the two hands.
export const HotseatDialog = ({ defaultOpen = false, onStart }: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const rememberedExpansions = usePrefsStore((s) => s.expansions);
  const setRememberedExpansions = usePrefsStore((s) => s.setExpansions);
  const [expansions, setExpansions] = useState<readonly ExpansionPiece[]>(rememberedExpansions);

  const toggle = (piece: ExpansionPiece): void =>
    setExpansions((picked) =>
      picked.includes(piece) ? picked.filter((p) => p !== piece) : [...picked, piece],
    );

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    setRememberedExpansions(expansions);
    setOpen(false);
    onStart(expansions);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          New game
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New game on this device</DialogTitle>
          <DialogDescription>
            Both colours are played from this screen. Pick the pieces you want in the hands.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <ExpansionPicker picked={expansions} onToggle={toggle} />
          <Button type="submit">Start game</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};
