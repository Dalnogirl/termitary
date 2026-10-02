import { BASE_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate } from './moves.js';

export const oneHive: RulesDemo = {
  id: 'one-hive',
  title: 'One hive',
  caption:
    'All pieces stay joined in one hive. A piece holding two parts together cannot move, because ' +
    'lifting it would split them, even for a moment.',
  ruleset: BASE_RULESET,
  setup: [
    place('queen', 'white', 0, 0),
    place('queen', 'black', 1, 0),
    place('ant', 'white', -1, 0),
    place('ant', 'black', 2, 0),
    place('ant', 'white', -2, 0),
    place('spider', 'black', 3, 0),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 0 } } },
    {
      kind: 'annotate',
      annotations: [
        { kind: 'pinned', at: { q: -1, r: 0 } },
        { kind: 'pinned', at: { q: 0, r: 0 } },
      ],
    },
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: -2, r: 0 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([-2, 0], [1, 1]) },
    { kind: 'pause' },
  ],
};
