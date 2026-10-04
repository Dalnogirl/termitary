import { BASE_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate } from './moves.js';

export const grasshopper: RulesDemo = {
  id: 'grasshopper',
  title: 'Grasshopper',
  caption:
    'The grasshopper jumps in a straight line over one or more pieces and lands in the first ' +
    'empty cell. It never slides, so a hole the ant cannot squeeze into is one jump away.',
  ruleset: BASE_RULESET,
  setup: [
    place('queen', 'white', 0, 0),
    place('queen', 'black', 1, -1),
    place('spider', 'white', 0, 1),
    place('spider', 'black', 2, -1),
    place('grasshopper', 'white', -1, 2),
    place('ant', 'black', 2, 0),
    place('ant', 'white', -1, 1),
    place('grasshopper', 'black', 3, -1),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 1 } } },
    { kind: 'annotate', annotations: [{ kind: 'blocked', at: { q: 1, r: 0 } }] },
    { kind: 'pause' },
    { kind: 'annotate', annotations: [] },
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 2 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([-1, 2], [1, 0]) },
    { kind: 'pause' },
  ],
};
