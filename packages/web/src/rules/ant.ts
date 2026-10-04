import { BASE_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate } from './moves.js';

export const ant: RulesDemo = {
  id: 'ant',
  title: 'Soldier ant',
  caption:
    'The ant slides any distance around the outside of the hive, so one move takes it to any ' +
    'cell on the edge. Only a gap too narrow to slide through stops it.',
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
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 1 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([-1, 1], [4, -1]) },
    { kind: 'pause' },
  ],
};
