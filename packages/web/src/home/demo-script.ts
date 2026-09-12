import type { GameState, Move } from '@termitary/engine';

// Seeded, not random: every visitor sees the same opening, and a sequence that
// looks bad is fixed by changing the seed rather than re-rolled at runtime.
const SEED = 0x5f3a91;

const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const OPENING_PLIES = 8;

const sameCoord = (a: { q: number; r: number }, b: { q: number; r: number }): boolean =>
  a.q === b.q && a.r === b.r;

// history.at(-2) is this player's own previous move. Undoing it reads as a
// piece twitching in place, which is the failure mode of weighted random play.
const isTakeback = (state: GameState, move: Move): boolean => {
  const own = state.history.at(-2);
  if (move.kind !== 'relocate' || own?.kind !== 'relocate') return false;
  return sameCoord(own.to, move.from) && sameCoord(own.from, move.to);
};

const weigh = (state: GameState, move: Move): number => {
  if (move.kind === 'pass' || isTakeback(state, move)) return 0;
  const placing = move.kind === 'place';
  if (state.history.length < OPENING_PLIES) return placing ? 4 : 1;
  return placing ? 1 : 3;
};

export type DemoPicker = (state: GameState, validMoves: readonly Move[]) => Move | undefined;

export const createDemoPicker = (): DemoPicker => {
  const rand = mulberry32(SEED);

  return (state, validMoves) => {
    if (state.status !== 'in_progress') return undefined;

    const weighted = validMoves.map((m) => [m, weigh(state, m)] as const).filter(([, w]) => w > 0);
    if (weighted.length === 0) return validMoves[0];

    let roll = rand() * weighted.reduce((sum, [, w]) => sum + w, 0);
    for (const [move, w] of weighted) {
      roll -= w;
      if (roll <= 0) return move;
    }
    return weighted.at(-1)?.[0];
  };
};
