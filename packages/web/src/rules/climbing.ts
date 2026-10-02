import { BASE_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate } from './moves.js';

export const climbing: RulesDemo = {
  id: 'climbing',
  title: 'Climbing',
  caption:
    'In the base game only the beetle climbs. It steps onto the hive, walks across the top one ' +
    'cell at a time and steps down beside it. The piece underneath cannot move, and the stack ' +
    'counts as the colour on top.',
  ruleset: BASE_RULESET,
  setup: [
    place('queen', 'white', 0, 0),
    place('queen', 'black', 1, 0),
    place('beetle', 'white', 0, -1),
    place('ant', 'black', 2, 0),
    relocate([0, -1], [1, -1]),
    place('spider', 'black', 3, 0),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: 1, r: -1 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([1, -1], [1, 0]) },
    { kind: 'move', move: place('grasshopper', 'black', 4, 0) },
    { kind: 'select', selection: { kind: 'board', coord: { q: 1, r: 0 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([1, 0], [1, 1]) },
    { kind: 'pause' },
  ],
};
