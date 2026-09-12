import {
  type Color,
  type HexCoord,
  type Piece,
  type PieceType,
  occupiedCells,
  topPieceAt,
} from '@hive/engine';
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
  readonly onBackgroundClick: () => void;
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

const movableOrigins = (state: StoreState, myColor: Color | null): Set<string> => {
  const out = new Set<string>();
  // In network play, only highlight my pieces. When it's the opponent's turn,
  // validMoves describes THEIR options — show no highlights at all. The input
  // handlers apply the same gate, so this is a presentation-mirror of intent.
  if (
    myColor !== null &&
    state.view.status === 'in_progress' &&
    state.view.currentPlayer !== myColor
  ) {
    return out;
  }
  for (const m of state.validMoves) {
    if (m.kind === 'relocate') out.add(coordKey(m.from));
  }
  return out;
};

// The piece that would appear on a target cell if the pending move committed.
// Drives the hover ghost, so the player sees what lands, not just where.
const landingPiece = (state: StoreState): PieceType | null => {
  const sel = state.selection;
  if (sel === null) return null;
  if (sel.kind === 'hand') return sel.piece;
  const top = topPieceAt(state.view.board, sel.coord);
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
        m.kind === 'relocate' && m.from.q === sel.coord.q && m.from.r === sel.coord.r ? [m.to] : [],
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

const outlineFor = (skin: Skin, selected: boolean, hinted: boolean): Outline | null => {
  if (selected) return { stroke: skin.theme.selectStroke, strokeWidth: 3 };
  if (hinted) return { stroke: skin.theme.hintStroke, strokeWidth: 2 };
  return null;
};

export const createRenderer = (
  container: HTMLDivElement,
  callbacks: RendererCallbacks,
  options: RendererOptions,
): Renderer => {
  const view = createView(container, callbacks.onBackgroundClick);
  const { board, overlay, setHoverCursor } = view;

  let latest: StoreState | null = null;
  const motion = createMotionRunner(overlay, () => {
    if (latest !== null) paint(latest);
  });

  const drawCell = (
    skin: Skin,
    coord: HexCoord,
    stack: readonly Piece[],
    movable: Set<string>,
    selectedCoord: string | null,
    hoverable: boolean,
  ): void => {
    const top = stack[stack.length - 1];
    if (!top) return;
    const p = axialToPixel(coord, HEX_SIZE);
    const key = coordKey(coord);
    const outline = outlineFor(skin, key === selectedCoord, movable.has(key));
    const tile = pieceTile(skin, top, outline);
    tile.position(p);
    tile.on('click tap', () => callbacks.onPieceClick(coord));
    if (hoverable && outline !== null) {
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
    const movable = movableOrigins(state, options.myColor);
    const selectedCoord =
      state.selection?.kind === 'board' ? coordKey(state.selection.coord) : null;
    const arriving = motion.arrivingAt();

    for (const [coord, stack] of occupiedCells(state.view.board)) {
      // The piece the overlay is carrying is already on the board in state, so
      // the destination cell has to give it up until it lands. A beetle in
      // flight leaves the piece it climbed onto showing.
      const settled = arriving !== null && sameCoord(coord, arriving) ? stack.slice(0, -1) : stack;
      if (settled.length === 0) continue;
      drawCell(skin, coord, settled, movable, selectedCoord, arriving === null);
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
