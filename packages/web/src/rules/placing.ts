import { BASE_RULESET } from '@termitary/engine';
import type { RulesDemo } from './demo.js';
import { place } from './moves.js';

export const placing: RulesDemo = {
  id: 'placing',
  title: 'Placing',
  caption:
    'White opens in the middle and black places anywhere beside it. After that, a new piece ' +
    'must touch your own colour and nothing of the other. Your queen has to be down by your ' +
    'fourth turn, and until it is, none of your pieces can move.',
  ruleset: BASE_RULESET,
  setup: [],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'hand', piece: 'spider' } },
    { kind: 'move', move: place('spider', 'white', 0, 0) },
    { kind: 'select', selection: { kind: 'hand', piece: 'spider' } },
    { kind: 'move', move: place('spider', 'black', 1, 0) },
    { kind: 'select', selection: { kind: 'hand', piece: 'ant' } },
    {
      kind: 'annotate',
      annotations: [
        { kind: 'blocked', at: { q: 1, r: -1 } },
        { kind: 'blocked', at: { q: 0, r: 1 } },
      ],
    },
    { kind: 'pause' },
    { kind: 'move', move: place('ant', 'white', -1, 0) },
    { kind: 'move', move: place('ant', 'black', 2, 0) },
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 0 } } },
    {
      kind: 'annotate',
      annotations: [
        { kind: 'pinned', at: { q: -1, r: 0 } },
        { kind: 'pinned', at: { q: 0, r: 0 } },
      ],
    },
    { kind: 'pause' },
    { kind: 'move', move: place('grasshopper', 'white', -2, 0) },
    { kind: 'move', move: place('queen', 'black', 3, 0) },
    { kind: 'select', selection: { kind: 'hand', piece: 'beetle' } },
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'hand', piece: 'queen' } },
    { kind: 'move', move: place('queen', 'white', -1, 1) },
    { kind: 'pause' },
    { kind: 'pause' },
  ],
};
