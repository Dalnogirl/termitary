import { BASE_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place, relocate } from './moves.js';

export const beetle: RulesDemo = {
  id: 'beetle',
  title: 'Beetle',
  caption:
    'The beetle moves one cell, like the queen, but it can also step up onto the hive. ' +
    'Whatever it lands on is stuck there until the beetle leaves, so a beetle on the queen ' +
    'freezes her in place.',
  ruleset: BASE_RULESET,
  setup: [
    place('queen', 'white', 0, 0),
    place('queen', 'black', 1, 0),
    place('beetle', 'white', -1, 0),
    place('ant', 'black', 2, 0),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 0 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([-1, 0], [0, 0]) },
    { kind: 'move', move: place('spider', 'black', 3, 0) },
    { kind: 'select', selection: { kind: 'board', coord: { q: 0, r: 0 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([0, 0], [1, 0]) },
    { kind: 'annotate', annotations: [{ kind: 'pinned', at: { q: 1, r: 0 } }] },
    { kind: 'pause' },
    { kind: 'pause' },
  ],
};
