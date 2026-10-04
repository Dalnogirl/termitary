import { PILLBUG_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate, throwPiece } from './moves.js';

export const pillbug: RulesDemo = {
  id: 'pillbug',
  title: 'Pillbug',
  caption:
    'The pillbug steps one cell like the queen. Instead of moving, it can pick up a piece ' +
    'next to it, of either colour, and set it down in another empty cell next to it. It cannot ' +
    'throw a piece that just moved, a piece the hive needs to stay joined, or anything stacked.',
  ruleset: PILLBUG_RULESET,
  setup: [
    place('queen', 'white', 0, 0),
    place('queen', 'black', 1, 0),
    place('pillbug', 'white', -1, 0),
    place('ant', 'black', 2, 0),
    place('spider', 'white', -1, 1),
    relocate([2, 0], [-2, 1]),
    place('grasshopper', 'white', -1, 2),
    place('spider', 'black', 2, 0),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 0 } } },
    { kind: 'pause' },
    {
      kind: 'select',
      selection: { kind: 'throw', by: { q: -1, r: 0 }, from: { q: -2, r: 1 } },
    },
    { kind: 'pause' },
    { kind: 'move', move: throwPiece([-1, 0], [-2, 1], [-1, -1]) },
    { kind: 'pause' },
  ],
};
