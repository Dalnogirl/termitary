import {
  type Color,
  type HexCoord,
  type Move,
  type Piece,
  type PieceType,
  occupiedCells,
  topPieceAt,
} from '@termitary/engine';
import type { Group } from 'konva/lib/Group.js';
import { prefsStore } from '../store/prefs.js';
import type { StoreState } from '../store/store.js';
import { axialToPixel } from './hex.js';
import { HEX_SIZE } from './metrics.js';
import { createMotionRunner, planMotion } from './motion.js';
import {
  type Outline,
  type Skin,
  chipTile,
  ghostNode,
  pieceTile,
  styleTarget,
  targetShape,
} from './nodes.js';
import { readTheme } from './theme.js';
import { createView } from './view.js';

export type RendererCallbacks = {
  readonly onTargetClick: (coord: HexCoord) => void;
  readonly onPieceClick: (coord: HexCoord) => void;
  readonly onClearSelection: () => void;
};

export type Renderer = {
  draw: (state: StoreState) => void;
  destroy: () => void;
};

export type RendererOptions = {
  readonly myColor: Color | null;
};

const coordKey = (c: HexCoord): string => `${c.q},${c.r}`;

const sameCoord = (a: HexCoord, b: HexCoord): boolean => a.q === b.q && a.r === b.r;

const dedupeCoords = (coords: readonly HexCoord[]): HexCoord[] => {
  const seen = new Set<string>();
  const out: HexCoord[] = [];
  for (const c of coords) {
    const k = coordKey(c);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out;
};

const NO_CELLS: Set<string> = new Set();

// In network play, while the opponent is to move validMoves describes THEIR
// options, so nothing on the board is worth pointing at. The input handlers
// apply the same gate, and the marks below are its presentation mirror.
const opponentsTurn = (state: StoreState, myColor: Color | null): boolean =>
  myColor !== null && state.view.status === 'in_progress' && state.view.currentPlayer !== myColor;

const movableOrigins = (state: StoreState): Set<string> => {
  const out = new Set<string>();
  for (const m of state.validMoves) {
    if (m.kind === 'relocate') out.add(coordKey(m.from));
    if (m.kind === 'throw') out.add(coordKey(m.by));
  }
  return out;
};

// The piece the player is acting from. Midway through a throw that is still
// the pillbug, not the neighbour it has picked up.
const selectedCell = (state: StoreState): HexCoord | null => {
  const sel = state.selection;
  if (sel?.kind === 'board') return sel.coord;
  if (sel?.kind === 'throw') return sel.by;
  return null;
};

const throwableNeighbours = (state: StoreState): Set<string> => {
  const out = new Set<string>();
  const by = selectedCell(state);
  if (by === null) return out;
  for (const m of state.validMoves) {
    if (m.kind === 'throw' && sameCoord(m.by, by)) out.add(coordKey(m.from));
  }
  return out;
};

// The piece that would appear on a target cell if the pending move committed.
// Drives the hover ghost, so the player sees what lands, not just where.
const landingPiece = (state: StoreState): PieceType | null => {
  const sel = state.selection;
  if (sel === null) return null;
  if (sel.kind === 'hand') return sel.piece;
  const top = topPieceAt(state.view.board, sel.kind === 'board' ? sel.coord : sel.from);
  return top === undefined ? null : top.type;
};

const targetsFor = (state: StoreState): HexCoord[] => {
  const sel = state.selection;
  if (sel?.kind === 'hand') {
    return dedupeCoords(
      state.validMoves.flatMap((m) =>
        m.kind === 'place' && m.piece.type === sel.piece ? [m.to] : [],
      ),
    );
  }
  if (sel?.kind === 'board') {
    return dedupeCoords(
      state.validMoves.flatMap((m) =>
        m.kind === 'relocate' && sameCoord(m.from, sel.coord) ? [m.to] : [],
      ),
    );
  }
  if (sel?.kind === 'throw') {
    return dedupeCoords(
      state.validMoves.flatMap((m) =>
        m.kind === 'throw' && sameCoord(m.by, sel.by) && sameCoord(m.from, sel.from) ? [m.to] : [],
      ),
    );
  }
  return [];
};

// Length alone, to match the trigger in planMotion: a flight is keyed to a
// history of a given depth, not to its contents.
const historyMoved = (before: StoreState | null, after: StoreState): boolean =>
  before !== null && before.view.history.length !== after.view.history.length;

const readSkin = (): Skin => {
  const { pieceSet, pieceHue } = prefsStore.getState();
  return { theme: readTheme(), set: pieceSet, hue: pieceHue };
};

// Every role a cell can play in the current selection, as cell keys.
type Marks = {
  readonly movable: Set<string>;
  readonly throwable: Set<string>;
  readonly selected: string | null;
  readonly lifted: string | null;
  readonly lastMove: string | null;
};

const outlineFor = (skin: Skin, marks: Marks, key: string): Outline | null => {
  if (key === marks.selected) return { stroke: skin.theme.selectStroke, strokeWidth: 3 };
  if (key === marks.lifted) return { stroke: skin.theme.throwStroke, strokeWidth: 3 };
  if (marks.throwable.has(key)) return { stroke: skin.theme.throwStroke, strokeWidth: 2 };
  if (marks.movable.has(key)) return { stroke: skin.theme.hintStroke, strokeWidth: 2 };
  if (key === marks.lastMove) return { stroke: skin.theme.lastMoveStroke, strokeWidth: 2 };
  return null;
};

// Where the move that produced this position put its piece. Stepping through
// the history is otherwise a slideshow of near-identical boards.
const landedAt = (move: Move | null): HexCoord | null =>
  move === null || move.kind === 'pass' ? null : move.to;

export const createRenderer = (
  container: HTMLDivElement,
  callbacks: RendererCallbacks,
  options: RendererOptions,
): Renderer => {
  const view = createView(container, callbacks.onClearSelection);
  const { board, overlay, setHoverCursor } = view;

  let latest: StoreState | null = null;
  const motion = createMotionRunner(overlay, () => {
    if (latest !== null) paint(latest);
  });

  const drawCell = (
    skin: Skin,
    coord: HexCoord,
    stack: readonly Piece[],
    marks: Marks,
    hoverable: boolean,
  ): void => {
    const top = stack[stack.length - 1];
    if (!top) return;
    const p = axialToPixel(coord, HEX_SIZE);
    const key = coordKey(coord);
    const clickable = marks.movable.has(key) || marks.throwable.has(key) || key === marks.lifted;
    const outline = outlineFor(skin, marks, key);
    const tile = pieceTile(skin, top, outline);
    tile.position(p);
    tile.on('click tap', () => callbacks.onPieceClick(coord));
    if (hoverable && clickable) {
      tile.on('mouseenter', () => setHoverCursor('pointer'));
      tile.on('mouseleave', () => setHoverCursor(''));
    }
    board.add(tile);

    const below = stack[stack.length - 2];
    if (below === undefined) return;
    const chip = chipTile(skin, below);
    chip.position({ x: p.x + HEX_SIZE * 0.55, y: p.y - HEX_SIZE * 0.65 });
    board.add(chip);
  };

  const drawTarget = (skin: Skin, coord: HexCoord, ghost: Group | null): void => {
    const p = axialToPixel(coord, HEX_SIZE);
    const poly = targetShape(skin.theme, p);
    poly.on('click tap', () => callbacks.onTargetClick(coord));
    poly.on('mouseenter', () => {
      styleTarget(poly, skin.theme, true);
      ghost?.position(p);
      ghost?.visible(true);
      setHoverCursor('pointer');
      board.batchDraw();
    });
    poly.on('mouseleave', () => {
      styleTarget(poly, skin.theme, false);
      ghost?.visible(false);
      setHoverCursor('');
      board.batchDraw();
    });
    board.add(poly);
  };

  const paint = (state: StoreState): void => {
    const skin = readSkin();
    // destroyChildren removes the hovered node without firing mouseleave, so
    // the pointer cursor would stick after a move commits.
    setHoverCursor('');
    board.destroyChildren();
    const selected = selectedCell(state);
    const lastMove = landedAt(state.lastMove);
    const theirs = opponentsTurn(state, options.myColor);
    const marks: Marks = {
      movable: theirs ? NO_CELLS : movableOrigins(state),
      throwable: theirs ? NO_CELLS : throwableNeighbours(state),
      selected: selected === null ? null : coordKey(selected),
      lifted: state.selection?.kind === 'throw' ? coordKey(state.selection.from) : null,
      lastMove: lastMove === null ? null : coordKey(lastMove),
    };
    const arriving = motion.arrivingAt();

    for (const [coord, stack] of occupiedCells(state.view.board)) {
      // The piece the overlay is carrying is already on the board in state, so
      // the destination cell has to give it up until it lands. A beetle in
      // flight leaves the piece it climbed onto showing.
      const settled = arriving !== null && sameCoord(coord, arriving) ? stack.slice(0, -1) : stack;
      if (settled.length === 0) continue;
      drawCell(skin, coord, settled, marks, arriving === null);
    }

    // No targets mid-flight: committing to a cell the arriving piece may be
    // about to occupy reads as a board that is lying about its own position.
    if (arriving === null) {
      const landing = landingPiece(state);
      // Built before the targets, because their handlers capture it, then
      // lifted above them so it is not drawn under a target's fill.
      const ghost = landing === null ? null : ghostNode(skin, landing);
      if (ghost !== null) {
        board.add(ghost);
        ghost.cache();
      }
      for (const coord of targetsFor(state)) {
        drawTarget(skin, coord, ghost);
      }
      ghost?.moveToTop();
    }

    board.draw();
  };

  const draw = (state: StoreState): void => {
    const before = latest;
    const next = planMotion(before, state);
    latest = state;
    // A motion animates one specific history entry. Anything that changes
    // history leaves it describing a board that no longer exists, so it snaps
    // home — a second move, but equally the rollback, pass or reconnect that
    // gives planMotion nothing to start. A draw that leaves history alone (a
    // selection, a server echo) lets it finish.
    if (next !== null || historyMoved(before, state)) {
      motion.stop();
    }
    if (next !== null) {
      const piece = topPieceAt(state.view.board, next.coord);
      if (piece !== undefined) motion.start(next, pieceTile(readSkin(), piece, null));
    }
    paint(state);
  };

  const destroy = (): void => {
    motion.stop();
    view.destroy();
  };

  return { draw, destroy };
};
