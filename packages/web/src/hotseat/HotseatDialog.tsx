import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import type { ExpansionPiece } from '@termitary/engine';
import { type FormEvent, useState } from 'react';
import { ExpansionPicker } from '../rooms/ExpansionPicker.js';
import { useExpansionDraft } from './use-expansion-draft.js';

type Props = {
  /** Open on arrival: the settings are the first thing the route asks about. */
  readonly defaultOpen?: boolean;
  readonly onStart: (expansions: readonly ExpansionPiece[]) => void;
};

// No seat picker: hot-seat plays both colours, so the only thing to choose is
// what is in the two hands.
export const HotseatDialog = ({ defaultOpen = false, onStart }: Props) => {
  const [open, setOpen] = useState(defaultOpen);
  const { expansions, toggle, commit } = useExpansionDraft();

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    const picked = commit();
    setOpen(false);
    onStart(picked);
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
