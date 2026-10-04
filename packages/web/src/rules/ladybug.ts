import { LADYBUG_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate } from './moves.js';

export const ladybug: RulesDemo = {
  id: 'ladybug',
  title: 'Ladybug',
  caption:
    'The ladybug always moves three cells: up onto the hive, one step across the top, then ' +
    'down into an empty cell. It never stops on top, and since it comes down from above it can ' +
    'drop into cells no sliding piece could reach.',
  ruleset: LADYBUG_RULESET,
  setup: [
    place('queen', 'white', 0, 0),
    place('queen', 'black', 1, 0),
    place('ladybug', 'white', -1, 0),
    place('ant', 'black', 2, 0),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 0 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([-1, 0], [2, -1]) },
    { kind: 'pause' },
  ],
};
