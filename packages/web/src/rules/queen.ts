import { BASE_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate } from './moves.js';

export const queen: RulesDemo = {
  id: 'queen',
  title: 'Queen bee',
  caption:
    'The queen slides one cell per turn, around the edge of the hive. She is slow, which is ' +
    'why getting her out early and keeping room around her matters.',
  ruleset: BASE_RULESET,
  setup: [
    place('spider', 'white', 0, 0),
    place('spider', 'black', 1, 0),
    place('queen', 'white', -1, 0),
    place('queen', 'black', 2, 0),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 0 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([-1, 0], [0, -1]) },
    { kind: 'move', move: place('ant', 'black', 3, 0) },
    { kind: 'select', selection: { kind: 'board', coord: { q: 0, r: -1 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([0, -1], [1, -1]) },
    { kind: 'pause' },
  ],
};
