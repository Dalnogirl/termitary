import { BASE_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate } from './moves.js';

export const spider: RulesDemo = {
  id: 'spider',
  title: 'Spider',
  caption:
    'The spider slides exactly three cells around the hive, never two and never four, and it ' +
    'cannot double back over a cell it just crossed. The cells it passes on the way are not ' +
    'places it can stop.',
  ruleset: BASE_RULESET,
  setup: [
    place('queen', 'white', 0, 0),
    place('queen', 'black', 1, 0),
    place('spider', 'white', -1, 0),
    place('spider', 'black', 2, 0),
    place('ant', 'white', -1, 1),
    place('ant', 'black', 3, -1),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 0 } } },
    {
      kind: 'annotate',
      annotations: [
        { kind: 'blocked', at: { q: 0, r: -1 } },
        { kind: 'blocked', at: { q: 1, r: -1 } },
      ],
    },
    { kind: 'pause' },
    { kind: 'move', move: relocate([-1, 0], [2, -1]) },
    { kind: 'pause' },
  ],
};
