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

// Random has no tile: the two seats it stands for are one cream mark and one
// dark mark, and the same glyph in inverted ink does not read as one pair.
const SEAT_GLYPH: Record<SeatChoice, ReactNode> = {
  white: <PieceTile type="queen" color="white" />,
  black: <PieceTile type="queen" color="black" />,
  random: null,
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
