import type { Move } from '../coordinator.js';
import type { HexCoord } from '../hex.js';

const relocate = (from: HexCoord, to: HexCoord): Move => ({ kind: 'relocate', from, to });

// White's queen holds the hive together and every free cell beside a white
// piece touches black, so after SQUEEZE white has nothing to do.
export const BEFORE_SQUEEZE: readonly Move[] = [
  { kind: 'place', piece: { type: 'queen', color: 'white' }, to: { q: 0, r: 0 } },
  { kind: 'place', piece: { type: 'queen', color: 'black' }, to: { q: 1, r: 0 } },
  relocate({ q: 0, r: 0 }, { q: 0, r: 1 }),
  { kind: 'place', piece: { type: 'ant', color: 'black' }, to: { q: 1, r: -1 } },
  relocate({ q: 0, r: 1 }, { q: 1, r: 1 }),
  { kind: 'place', piece: { type: 'ant', color: 'black' }, to: { q: 0, r: -1 } },
  relocate({ q: 1, r: 1 }, { q: 0, r: 1 }),
  { kind: 'place', piece: { type: 'ant', color: 'black' }, to: { q: 2, r: -1 } },
  relocate({ q: 0, r: 1 }, { q: 0, r: 0 }),
];

export const SQUEEZE: Move = relocate({ q: 2, r: -1 }, { q: -1, r: 1 });
