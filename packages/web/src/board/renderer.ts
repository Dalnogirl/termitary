import { Stage } from 'konva/lib/Stage.js';
import { Layer } from 'konva/lib/Layer.js';
import { Line } from 'konva/lib/shapes/Line.js';
import { Text } from 'konva/lib/shapes/Text.js';
import { type HexCoord, occupiedCells } from '@hive/engine';
import { axialToPixel, hexCorners } from './hex.js';
import { pieceFill, pieceLetter, pieceStroke, pieceTextColor } from './pieces.js';
import type { StoreState } from '../store/store.js';

const HEX_SIZE = 40;

export type RendererCallbacks = {
  readonly onTargetClick: (coord: HexCoord) => void;
};

export type Renderer = {
  draw: (state: StoreState) => void;
  destroy: () => void;
};

const dedupeCoords = (coords: readonly HexCoord[]): HexCoord[] => {
  const seen = new Set<string>();
  const out: HexCoord[] = [];
  for (const c of coords) {
    const k = `${c.q},${c.r}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(c);
    }
  }
  return out;
};

const placementTargets = (state: StoreState): HexCoord[] => {
  const sel = state.selection;
  if (sel?.kind !== 'hand') return [];
  const coords = state.validMoves.flatMap((m) =>
    m.kind === 'place' && m.piece.type === sel.piece ? [m.to] : [],
  );
  return dedupeCoords(coords);
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

  const draw = (state: StoreState): void => {
    layer.destroyChildren();
    const cx = stage.width() / 2;
    const cy = stage.height() / 2;

    for (const [coord, stack] of occupiedCells(state.game.board)) {
      const top = stack[stack.length - 1];
      if (!top) continue;
      const p = axialToPixel(coord, HEX_SIZE);
      const center = { x: cx + p.x, y: cy + p.y };
      const poly = new Line({
        points: hexCorners(center, HEX_SIZE),
        closed: true,
        fill: pieceFill(top),
        stroke: pieceStroke(top),
        strokeWidth: 2,
      });
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

    for (const coord of placementTargets(state)) {
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
      poly.on('click', () => callbacks.onTargetClick(coord));
      poly.on('tap', () => callbacks.onTargetClick(coord));
      layer.add(poly);
    }

    layer.draw();
  };

  const destroy = (): void => {
    stage.destroy();
  };

  return { draw, destroy };
};
