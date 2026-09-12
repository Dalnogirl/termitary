import {
  type Color,
  type GameState,
  type HexCoord,
  type Move,
  type PieceType,
  applyMove,
  createGame,
} from '@termitary/engine';
import { beforeEach, describe, expect, it } from 'vitest';
import { gameStore } from '../store/store.js';
import { createInputHandlers } from './input.js';
import type { Controller } from './port.js';

const commits: Move[] = [];
const controller: Controller = {
  commitMove: (move) => {
    commits.push(move);
  },
};

const at = (q: number, r: number): HexCoord => ({ q, r });

const placing = (type: PieceType, color: Color, to: HexCoord): Move => ({
  kind: 'place',
  piece: { type, color },
  to,
});

const WHITE_QUEEN = at(0, 0);
const BLACK_QUEEN = at(1, 0);

// Both queens down and white to move, the earliest position where a relocate
// exists. White's queen at WHITE_QUEEN can step to either neighbour it shares
// with black's.
const bothQueensDown = (): GameState =>
  applyMove(
    applyMove(createGame(), placing('queen', 'white', WHITE_QUEEN)),
    placing('queen', 'black', BLACK_QUEEN),
  );

const load = (game: GameState): void => {
  gameStore.getState().applyGameState(game);
};

const relocateTarget = (from: HexCoord): HexCoord => {
  const move = gameStore
    .getState()
    .validMoves.find((m) => m.kind === 'relocate' && m.from.q === from.q && m.from.r === from.r);
  if (move === undefined || move.kind !== 'relocate') throw new Error('no relocate to use');
  return move.to;
};

describe('createInputHandlers', () => {
  beforeEach(() => {
    commits.length = 0;
    gameStore.getState().reset();
  });

  describe('selecting a piece on the board', () => {
    it('selects a piece that has somewhere to go', () => {
      load(bothQueensDown());
      createInputHandlers(controller, 'white').handleBoardPieceClick(WHITE_QUEEN);

      expect(gameStore.getState().selection).toEqual({ kind: 'board', coord: WHITE_QUEEN });
    });

    it('deselects when the already-selected piece is clicked again', () => {
      load(bothQueensDown());
      const handlers = createInputHandlers(controller, 'white');
      handlers.handleBoardPieceClick(WHITE_QUEEN);

      handlers.handleBoardPieceClick(WHITE_QUEEN);

      expect(gameStore.getState().selection).toBeNull();
    });

    it('ignores a piece with no relocate of its own', () => {
      load(bothQueensDown());
      createInputHandlers(controller, 'white').handleBoardPieceClick(BLACK_QUEEN);

      expect(gameStore.getState().selection).toBeNull();
    });

    it('leaves an existing selection alone when an unmovable piece is clicked', () => {
      load(bothQueensDown());
      const handlers = createInputHandlers(controller, 'white');
      handlers.handleBoardPieceClick(WHITE_QUEEN);

      handlers.handleBoardPieceClick(BLACK_QUEEN);

      expect(gameStore.getState().selection).toEqual({ kind: 'board', coord: WHITE_QUEEN });
    });
  });

  describe('committing a move', () => {
    it('places the selected hand piece on a legal cell', () => {
      gameStore.getState().setSelection({ kind: 'hand', piece: 'queen' });

      createInputHandlers(controller, 'white').handleTargetClick(WHITE_QUEEN);

      expect(commits).toEqual([placing('queen', 'white', WHITE_QUEEN)]);
    });

    it('places for whichever side is to move, not the side that opened', () => {
      load(applyMove(createGame(), placing('queen', 'white', WHITE_QUEEN)));
      gameStore.getState().setSelection({ kind: 'hand', piece: 'queen' });

      createInputHandlers(controller, null).handleTargetClick(BLACK_QUEEN);

      expect(commits).toEqual([placing('queen', 'black', BLACK_QUEEN)]);
    });

    it('relocates the selected board piece to a legal cell', () => {
      load(bothQueensDown());
      const to = relocateTarget(WHITE_QUEEN);
      gameStore.getState().setSelection({ kind: 'board', coord: WHITE_QUEEN });

      createInputHandlers(controller, 'white').handleTargetClick(to);

      expect(commits).toEqual([{ kind: 'relocate', from: WHITE_QUEEN, to }]);
    });

    it('ignores a target that is not a legal destination for the selection', () => {
      load(bothQueensDown());
      gameStore.getState().setSelection({ kind: 'board', coord: WHITE_QUEEN });

      createInputHandlers(controller, 'white').handleTargetClick(at(9, 9));

      expect(commits).toEqual([]);
    });

    it('ignores a target click with nothing selected', () => {
      createInputHandlers(controller, 'white').handleTargetClick(WHITE_QUEEN);

      expect(commits).toEqual([]);
    });
  });

  describe('passing', () => {
    // A real pass-only position takes a long, fragile setup to reach. The
    // handler's contract is over validMoves, so the store is loaded with the
    // shape the engine would produce instead.
    const passOnly = (): void => {
      gameStore.setState({ validMoves: [{ kind: 'pass' }] });
    };

    it('passes when passing is the only thing left to do', () => {
      passOnly();

      createInputHandlers(controller, 'white').handlePassClick();

      expect(commits).toEqual([{ kind: 'pass' }]);
    });

    it('refuses to pass while a real move is available', () => {
      const real = gameStore.getState().validMoves[0];
      if (real === undefined) throw new Error('expected an opening move');
      gameStore.setState({ validMoves: [{ kind: 'pass' }, real] });

      createInputHandlers(controller, 'white').handlePassClick();

      expect(commits).toEqual([]);
    });

    it('does nothing when there is no pass to make', () => {
      createInputHandlers(controller, 'white').handlePassClick();

      expect(commits).toEqual([]);
    });
  });

  describe('gating on whose turn it is', () => {
    // validMoves describes the opponent's options while they are to move, so
    // acting on them would let this client play their side.
    it('ignores every action while the opponent is to move', () => {
      load(bothQueensDown());
      const to = relocateTarget(WHITE_QUEEN);
      gameStore.getState().setSelection({ kind: 'board', coord: WHITE_QUEEN });
      const handlers = createInputHandlers(controller, 'black');

      handlers.handleBoardPieceClick(WHITE_QUEEN);
      handlers.handleTargetClick(to);
      handlers.handlePassClick();

      expect(commits).toEqual([]);
      expect(gameStore.getState().selection).toEqual({ kind: 'board', coord: WHITE_QUEEN });
    });

    it('lets hot-seat play both sides', () => {
      load(bothQueensDown());
      const to = relocateTarget(WHITE_QUEEN);
      gameStore.getState().setSelection({ kind: 'board', coord: WHITE_QUEEN });

      createInputHandlers(controller, null).handleTargetClick(to);

      expect(commits).toEqual([{ kind: 'relocate', from: WHITE_QUEEN, to }]);
    });

    it('ignores every action once the game is finished', () => {
      load({ ...bothQueensDown(), status: 'finished', result: 'draw' });
      gameStore.getState().setSelection({ kind: 'board', coord: WHITE_QUEEN });
      const handlers = createInputHandlers(controller, 'white');

      handlers.handleBoardPieceClick(WHITE_QUEEN);
      handlers.handleTargetClick(BLACK_QUEEN);
      handlers.handlePassClick();

      expect(commits).toEqual([]);
      expect(gameStore.getState().selection).toEqual({ kind: 'board', coord: WHITE_QUEEN });
    });
  });

  it('clears the selection on a background click', () => {
    gameStore.getState().setSelection({ kind: 'hand', piece: 'queen' });

    createInputHandlers(controller, 'white').handleBackgroundClick();

    expect(gameStore.getState().selection).toBeNull();
  });
});
