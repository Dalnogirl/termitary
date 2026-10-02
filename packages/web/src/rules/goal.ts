import { BASE_RULESET, type Color, type Move, type PieceType } from '@termitary/engine';
import type { RulesDemo } from './demo.js';

const place = (type: PieceType, color: Color, q: number, r: number): Move => ({
  kind: 'place',
  piece: { type, color },
  to: { q, r },
});

const relocate = (from: [number, number], to: [number, number]): Move => ({
  kind: 'relocate',
  from: { q: from[0], r: from[1] },
  to: { q: to[0], r: to[1] },
});

export const goal: RulesDemo = {
  id: 'goal',
  title: 'The goal',
  caption:
    'Surround the other queen on all six sides and you win. Any piece counts, yours or theirs. ' +
    'A move that surrounds both queens at once is a draw.',
  ruleset: BASE_RULESET,
  setup: [
    place('grasshopper', 'white', 0, 0),
    place('queen', 'black', 1, 0),
    place('queen', 'white', -1, 0),
    place('ant', 'black', 2, 0),
    place('ant', 'white', -1, 1),
    place('beetle', 'black', 2, -1),
    relocate([-1, 1], [0, 1]),
    place('spider', 'black', 3, 0),
    place('ant', 'white', -2, 1),
    place('grasshopper', 'black', 3, -1),
    relocate([-2, 1], [1, 1]),
    place('beetle', 'black', 3, 1),
    place('ant', 'white', -1, 1),
    place('spider', 'black', 4, -1),
  ],
  script: [
    { kind: 'pause' },
    { kind: 'select', selection: { kind: 'board', coord: { q: -1, r: 1 } } },
    { kind: 'pause' },
    { kind: 'move', move: relocate([-1, 1], [1, -1]) },
    { kind: 'pause' },
    { kind: 'pause' },
  ],
};
