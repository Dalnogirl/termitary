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
import { SettingsIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { PieceMark } from '../board/PieceMark.js';
import { PIECE_SETS, PIECE_SET_IDS, type PieceSet } from '../board/piece-sets.js';
import type { PieceHue } from '../board/pieces.js';
import { usePrefsStore } from '../store/prefs.js';

const PREVIEW: readonly PieceType[] = [
  'queen',
  'ant',
  'beetle',
  'spider',
  'grasshopper',
  'ladybug',
  'mosquito',
  'pillbug',
];

const tileClass: Record<Color, string> = {
  white: 'bg-(--piece-white-fill)',
  black: 'bg-(--piece-black-fill) border border-border',
};

type PreviewProps = {
  readonly color: Color;
  readonly set: PieceSet;
  readonly hue: PieceHue;
};

const PreviewRow = ({ color, set, hue }: PreviewProps) => (
  <span className="flex gap-1.5">
    {PREVIEW.map((type) => (
      <span
        key={type}
        className={cn(
          'inline-flex size-9 items-center justify-center rounded-lg',
          tileClass[color],
        )}
      >
        <PieceMark type={type} color={color} size={22} set={set} hue={hue} />
      </span>
    ))}
  </span>
);

type OptionProps = {
  readonly group: string;
  readonly name: string;
  readonly note: string;
  readonly selected: boolean;
  readonly onSelect: () => void;
  readonly children: ReactNode;
};

const Option = ({ group, name, note, selected, onSelect, children }: OptionProps) => (
  <label
    className={cn(
      'flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors cursor-pointer',
      'focus-within:ring-2 focus-within:ring-foreground/30',
      selected ? 'border-foreground bg-muted/50' : 'border-border hover:bg-muted/30',
    )}
  >
    <span className="flex items-center gap-2">
      <input type="radio" name={group} checked={selected} onChange={onSelect} className="sr-only" />
      <span className="text-sm font-medium">{name}</span>
    </span>
    {children}
    <span className="text-xs text-muted-foreground">{note}</span>
  </label>
);

const PieceSetSection = () => {
  const pieceSet = usePrefsStore((s) => s.pieceSet);
  const pieceHue = usePrefsStore((s) => s.pieceHue);
  const setPieceSet = usePrefsStore((s) => s.setPieceSet);

  return (
    <fieldset className="grid gap-2 border-0 p-0 m-0">
      <legend className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2">
        Pieces
      </legend>
      {PIECE_SET_IDS.map((id) => (
        <Option
          key={id}
          group="piece-set"
          name={PIECE_SETS[id].name}
          note={PIECE_SETS[id].note}
          selected={pieceSet === id}
          onSelect={() => setPieceSet(id)}
        >
          <PreviewRow color="black" set={id} hue={pieceHue} />
        </Option>
      ))}
    </fieldset>
  );
};

const PieceHueSection = () => {
  const pieceSet = usePrefsStore((s) => s.pieceSet);
  const pieceHue = usePrefsStore((s) => s.pieceHue);
  const setPieceHue = usePrefsStore((s) => s.setPieceHue);

  return (
    <fieldset className="grid gap-2 border-0 p-0 m-0">
      <legend className="text-xs uppercase tracking-[0.12em] text-muted-foreground mb-2">
        Colour
      </legend>
      <Option
        group="piece-hue"
        name="Same on both"
        note="One tone per piece, whichever player holds it."
        selected={pieceHue === 'shared'}
        onSelect={() => setPieceHue('shared')}
      >
        <span className="grid gap-1.5">
          <PreviewRow color="white" set={pieceSet} hue="shared" />
          <PreviewRow color="black" set={pieceSet} hue="shared" />
        </span>
      </Option>
      <Option
        group="piece-hue"
        name="Tuned per tile"
        note="A deeper tone on white's tiles, for contrast."
        selected={pieceHue === 'per-tile'}
        onSelect={() => setPieceHue('per-tile')}
      >
        <span className="grid gap-1.5">
          <PreviewRow color="white" set={pieceSet} hue="per-tile" />
          <PreviewRow color="black" set={pieceSet} hue="per-tile" />
        </span>
      </Option>
      <Option
        group="piece-hue"
        name="No colour"
        note="Every piece in its tile's own contrast tone."
        selected={pieceHue === 'mono'}
        onSelect={() => setPieceHue('mono')}
      >
        <span className="grid gap-1.5">
          <PreviewRow color="white" set={pieceSet} hue="mono" />
          <PreviewRow color="black" set={pieceSet} hue="mono" />
        </span>
      </Option>
    </fieldset>
  );
};

export const SettingsDialog = () => (
  <Dialog>
    <DialogTrigger asChild>
      <Button variant="ghost" size="sm" aria-label="Settings">
        <SettingsIcon className="size-4" />
      </Button>
    </DialogTrigger>
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Settings</DialogTitle>
        <DialogDescription>How pieces are drawn, everywhere they appear.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-5">
        <PieceSetSection />
        <PieceHueSection />
      </div>
    </DialogContent>
  </Dialog>
);
