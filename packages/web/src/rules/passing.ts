import { BASE_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate } from './moves.js';

export const passing: RulesDemo = {
  id: 'passing',
  title: 'Passing',
  caption:
    'You pass only when you have no legal move at all: nothing on the board can move and ' +
    'nowhere is free to place. Here black closes in, the white queen is holding the hive ' +
    'together, and every empty cell next to her touches black.',
  ruleset: BASE_RULESET,
  setup: [
    place('queen', 'white', 0, 0),
    place('queen', 'black', 1, 0),
    relocate([0, 0], [0, 1]),
    place('ant', 'black', 1, -1),
    relocate([0, 1], [1, 1]),
    place('ant', 'black', 0, -1),
    relocate([1, 1], [0, 1]),
    place('ant', 'black', 2, -1),
    relocate([0, 1], [0, 0]),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'move', move: relocate([2, -1], [-1, 1]) },
    { kind: 'select', selection: { kind: 'hand', piece: 'ant' } },
    {
      kind: 'annotate',
      annotations: [
        { kind: 'pinned', at: { q: 0, r: 0 } },
        { kind: 'blocked', at: { q: -1, r: 0 } },
        { kind: 'blocked', at: { q: 0, r: 1 } },
      ],
    },
    { kind: 'pause' },
    { kind: 'pause' },
    { kind: 'move', move: { kind: 'pass' } },
    { kind: 'pause' },
  ],
};
