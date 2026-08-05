import { Stage } from 'konva/lib/Stage.js';
import { Layer } from 'konva/lib/Layer.js';
import { Line } from 'konva/lib/shapes/Line.js';
import type { HexCoord } from '@hive/engine';
import { axialToPixel, hexCorners } from './hex.js';
import type { StoreState } from '../store/store.js';

const HEX_SIZE = 40;

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

export const createRenderer = (container: HTMLDivElement): Renderer => {
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

    const targets = dedupeCoords(
      state.validMoves.flatMap((m) => (m.kind === 'place' ? [m.to] : [])),
    );

    for (const coord of targets) {
      const p = axialToPixel(coord, HEX_SIZE);
      const poly = new Line({
        points: hexCorners({ x: cx + p.x, y: cy + p.y }, HEX_SIZE),
        closed: true,
        fill: '#fff8dc',
        stroke: '#999',
        strokeWidth: 2,
        dash: [6, 4],
      });
      layer.add(poly);
    }

    layer.draw();
  };

  const destroy = (): void => {
    stage.destroy();
  };

  return { draw, destroy };
};
