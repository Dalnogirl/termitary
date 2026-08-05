import { Stage } from 'konva/lib/Stage.js';
import { Layer } from 'konva/lib/Layer.js';
import { Line } from 'konva/lib/shapes/Line.js';
import { Text } from 'konva/lib/shapes/Text.js';
import { type HexCoord, occupiedCells } from '@hive/engine';
import { axialToPixel, hexCorners } from './hex.js';
import { pieceFill, pieceLetter, pieceStroke, pieceTextColor } from './pieces.js';
import type { StoreState } from '../store/store.js';

const HEX_SIZE = 40;
const SELECT_STROKE = '#f5d56a';
const HINT_STROKE = '#bba85a';

export type RendererCallbacks = {
  readonly onTargetClick: (coord: HexCoord) => void;
  readonly onPieceClick: (coord: HexCoord) => void;
  readonly onBackgroundClick: () => void;
};

export type Renderer = {
  draw: (state: StoreState) => void;
  destroy: () => void;
};

const coordKey = (c: HexCoord): string => `${c.q},${c.r}`;

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

const movableOrigins = (state: StoreState): Set<string> => {
  const out = new Set<string>();
  for (const m of state.validMoves) {
    if (m.kind === 'relocate') out.add(coordKey(m.from));
  }
  return out;
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
        m.kind === 'relocate' && m.from.q === sel.coord.q && m.from.r === sel.coord.r
          ? [m.to]
          : [],
      ),
    );
  }
  return [];
};

export const createRenderer = (
  container: HTMLDivElement,
  callbacks: RendererCallbacks,
): Renderer => {
  const stage = new Stage({
    container,
    width: container.clientWidth || 800,
    height: container.clientHeight || 600,
  });
  const layer = new Layer();
  stage.add(layer);

  stage.on('click tap', (e) => {
    if (e.target === stage) callbacks.onBackgroundClick();
  });

  const draw = (state: StoreState): void => {
    layer.destroyChildren();
    const cx = stage.width() / 2;
    const cy = stage.height() / 2;
    const movable = movableOrigins(state);
    const selectedCoord =
      state.selection?.kind === 'board' ? coordKey(state.selection.coord) : null;

    for (const [coord, stack] of occupiedCells(state.game.board)) {
      const top = stack[stack.length - 1];
      if (!top) continue;
      const p = axialToPixel(coord, HEX_SIZE);
      const center = { x: cx + p.x, y: cy + p.y };
      const key = coordKey(coord);
      const isSelected = key === selectedCoord;
      const isHinted = movable.has(key);
      const stroke = isSelected ? SELECT_STROKE : isHinted ? HINT_STROKE : pieceStroke(top);
      const strokeWidth = isSelected ? 4 : isHinted ? 3 : 2;
      const poly = new Line({
        points: hexCorners(center, HEX_SIZE),
        closed: true,
        fill: pieceFill(top),
        stroke,
        strokeWidth,
      });
      poly.on('click tap', () => callbacks.onPieceClick(coord));
      const text = new Text({
        x: center.x - HEX_SIZE,
        y: center.y - HEX_SIZE,
        width: HEX_SIZE * 2,
        height: HEX_SIZE * 2,
        text: pieceLetter(top.type),
        fontSize: HEX_SIZE,
        fontStyle: 'bold',
        fill: pieceTextColor(top),
        align: 'center',
        verticalAlign: 'middle',
        listening: false,
      });
      layer.add(poly, text);
    }

    for (const coord of targetsFor(state)) {
      const p = axialToPixel(coord, HEX_SIZE);
      const center = { x: cx + p.x, y: cy + p.y };
      const poly = new Line({
        points: hexCorners(center, HEX_SIZE),
        closed: true,
        fill: '#fff8dc',
        stroke: '#bba85a',
        strokeWidth: 2,
        dash: [6, 4],
        opacity: 0.7,
      });
      poly.on('click tap', () => callbacks.onTargetClick(coord));
      layer.add(poly);
    }

    layer.draw();
  };

  const destroy = (): void => {
    stage.destroy();
  };

  return { draw, destroy };
};
