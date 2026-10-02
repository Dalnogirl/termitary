import { BASE_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate } from './moves.js';

export const freedom: RulesDemo = {
  id: 'freedom-to-move',
  title: 'Freedom to move',
  caption:
    'Pieces slide along the ground. A gap with a piece on each side is too narrow to slide ' +
    'through, so the ant cannot reach the hole beside it, even though the hole is empty.',
  ruleset: BASE_RULESET,
  setup: [
    place('queen', 'white', 0, 0),
    place('queen', 'black', 1, -1),
    place('spider', 'white', -1, 0),
    place('ant', 'black', 2, -2),
    place('grasshopper', 'white', -2, 1),
    place('spider', 'black', 2, -1),
    place('beetle', 'white', -2, 2),
    place('grasshopper', 'black', 1, -2),
    place('grasshopper', 'white', -1, 2),
    place('beetle', 'black', 3, -2),
    place('ant', 'white', 0, 1),
    place('ant', 'black', 3, -1),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: 0, r: 1 } } },
    {
      kind: 'annotate',
      annotations: [
        {
          kind: 'gate',
          between: [
            { q: 0, r: 1 },
            { q: -1, r: 1 },
          ],
        },
        { kind: 'blocked', at: { q: -1, r: 1 } },
      ],
    },
    { kind: 'pause' },
    { kind: 'move', move: relocate([0, 1], [-3, 1]) },
    { kind: 'pause' },
  ],
};
