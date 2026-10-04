import { MOSQUITO_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate } from './moves.js';

export const mosquito: RulesDemo = {
  id: 'mosquito',
  title: 'Mosquito',
  caption:
    'The mosquito has no move of its own. It moves as any piece it touches, of either colour, ' +
    'so next to a grasshopper it jumps and next to a beetle it climbs. Once it is on top of the ' +
    'hive it moves only as a beetle until it climbs down.',
  ruleset: MOSQUITO_RULESET,
  setup: [
    place('queen', 'white', 0, 0),
    place('queen', 'black', 1, 0),
    place('mosquito', 'white', -1, 0),
    place('beetle', 'black', 2, 0),
    place('grasshopper', 'white', -1, 1),
    place('ant', 'black', 3, -1),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 0 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([-1, 0], [3, 0]) },
    { kind: 'move', move: place('spider', 'black', 4, -2) },
    { kind: 'select', selection: { kind: 'board', coord: { q: 3, r: 0 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([3, 0], [2, 0]) },
    { kind: 'move', move: place('spider', 'black', 4, -3) },
    { kind: 'select', selection: { kind: 'board', coord: { q: 2, r: 0 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([2, 0], [1, 0]) },
    { kind: 'pause' },
  ],
};
