import type { WireTimeControl } from '@termitary/protocol';

/** `5+3` for real-time, minutes then seconds, the way lichess writes it. */
export const timeControlLabel = (control: WireTimeControl): string => {
  switch (control.kind) {
    case 'untimed':
      return 'Untimed';
    case 'correspondence':
      return control.daysPerMove === 1 ? '1 day per move' : `${control.daysPerMove} days per move`;
    case 'realtime':
      return `${control.initialMs / 60_000}+${control.incrementMs / 1000}`;
  }
};
