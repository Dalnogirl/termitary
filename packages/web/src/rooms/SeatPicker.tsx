import type { SeatChoice } from '@termitary/protocol';
import type { ReactNode } from 'react';
import { PieceTile } from '../board/PieceTile.js';
import { OptionRow } from './OptionRow.js';

const SEATS: readonly {
  readonly value: SeatChoice;
  readonly name: string;
  readonly note: string;
}[] = [
  { value: 'white', name: 'White', note: 'You move first.' },
  { value: 'black', name: 'Black', note: 'Your opponent opens.' },
  { value: 'random', name: 'Random', note: 'Decided now, before anyone joins.' },
];

// Random overlaps its two tiles by a corner: enough to read as one glyph, not
// so much that the lower tile's piece is half covered. The pair is as wide as
// a single tile, so every row starts its text in the same column.
const SEAT_GLYPH: Record<SeatChoice, ReactNode> = {
  white: <PieceTile type="queen" color="white" />,
  black: <PieceTile type="queen" color="black" />,
  random: (
    <span className="flex items-center">
      <PieceTile type="queen" color="white" size="sm" />
      <span className="-ml-1">
        <PieceTile type="queen" color="black" size="sm" />
      </span>
    </span>
  ),
};

type Props = {
  readonly seat: SeatChoice;
  readonly onPick: (seat: SeatChoice) => void;
};

export const SeatPicker = ({ seat, onPick }: Props) => (
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
        onSelect={() => onPick(value)}
      />
    ))}
  </fieldset>
);
