import { PieceTile } from '../board/PieceTile.js';
import { OptionRow } from './OptionRow.js';
import { EXPANSIONS, type ExpansionPiece } from './expansions.js';

type Props = {
  readonly picked: readonly ExpansionPiece[];
  readonly onToggle: (piece: ExpansionPiece) => void;
};

export const ExpansionPicker = ({ picked, onToggle }: Props) => (
  <fieldset className="grid gap-2 border-0 p-0 m-0">
    <legend className="text-xs text-muted-foreground pb-2">Expansion pieces</legend>
    {EXPANSIONS.map(({ piece, label, note }) => (
      <OptionRow
        key={piece}
        control="checkbox"
        group="expansion"
        value={piece}
        selected={picked.includes(piece)}
        glyph={<PieceTile type={piece} color="white" />}
        name={label}
        note={note}
        onSelect={() => onToggle(piece)}
      />
    ))}
  </fieldset>
);
