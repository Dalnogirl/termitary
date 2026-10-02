import { type GameState, type HexCoord, type Move, applyMove, createGame } from '@termitary/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { gameStore } from '../store/store.js';
import { coordKey, interaction, turnHolder } from './interaction.js';

const at = (q: number, r: number): HexCoord => ({ q, r });

const WHITE_QUEEN = at(0, 0);
const BLACK_QUEEN = at(1, 0);

const bothQueensDown = (): GameState =>
  applyMove(
    applyMove(createGame(), {
      kind: 'place',
      piece: { type: 'queen', color: 'white' },
      to: WHITE_QUEEN,
    }),
    { kind: 'place', piece: { type: 'queen', color: 'black' }, to: BLACK_QUEEN },
  );

const load = (game: GameState): void => {
  gameStore.getState().applyGameState(game);
};

const now = () => interaction(gameStore.getState(), null);

describe('interaction', () => {
  beforeEach(() => {
    gameStore.getState().reset();
  });

  it('highlights exactly the cells whose click commits a move', () => {
    load(bothQueensDown());
    gameStore.getState().setSelection({ kind: 'board', coord: WHITE_QUEEN });

    const relocates = gameStore
      .getState()
      .validMoves.filter((m): m is Extract<Move, { kind: 'relocate' }> => m.kind === 'relocate');
    expect([...now().targets.keys()].sort()).toEqual(relocates.map((m) => coordKey(m.to)).sort());
    for (const m of relocates) expect(now().targets.get(coordKey(m.to))).toEqual(m);
  });

  it('offers nothing while the opponent is to move', () => {
    load(bothQueensDown());
    gameStore.getState().setSelection({ kind: 'board', coord: WHITE_QUEEN });

    const can = interaction(gameStore.getState(), 'black');

    expect(can.actor).toBeNull();
    expect(can.movable.size).toBe(0);
    expect(can.targets.size).toBe(0);
  });

  it('offers nothing once the game is finished', () => {
    load({
      ...bothQueensDown(),
      status: 'finished',
      result: 'draw',
      endReason: 'queen-surrounded',
    });

    expect(now().actor).toBeNull();
    expect(now().movable.size).toBe(0);
  });

  describe('viewing an earlier position', () => {
    // viewAt also empties validMoves off-live, so this holds the gate to its
    // own reason rather than to that.
    it('offers nothing even with moves in the store', () => {
      load(bothQueensDown());
      gameStore.getState().setViewIndex(1);
      gameStore.setState({ validMoves: gameStore.getState().liveGame.history });

      expect(now().actor).toBeNull();
      expect(now().placeable.size).toBe(0);
    });

    it('still names whose turn it was', () => {
      load(bothQueensDown());
      gameStore.getState().setViewIndex(1);

      expect(turnHolder(gameStore.getState(), null)).toBe('black');
    });
  });

  it('answers with the same object until the store changes', () => {
    expect(now()).toBe(now());
  });
});
