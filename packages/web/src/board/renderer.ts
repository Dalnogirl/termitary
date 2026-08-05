import { Stage } from 'konva/lib/Stage.js';
import { Layer } from 'konva/lib/Layer.js';
import { Text } from 'konva/lib/shapes/Text.js';
import { type HexCoord, type Piece, occupiedCells } from '@hive/engine';
import { axialToPixel, createHexShape } from './hex.js';
import { pieceFill, pieceLetter, pieceTextColor } from './pieces.js';
import { type CanvasTheme, readTheme } from './theme.js';
import type { StoreState } from '../store/store.js';

const HEX_SIZE = 40;
const HEX_DRAW_SIZE = 38;
const HEX_RADIUS = 7;
const TARGET_SIZE = 36;
const TARGET_RADIUS = 6;
const CHIP_SIZE = 14;
const CHIP_RADIUS = 3;
const SCALE_MIN = 0.4;
const SCALE_MAX = 3;
const SCALE_FACTOR = 1.1;

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
  const layer = new Layer({
    x: stage.width() / 2,
    y: stage.height() / 2,
  });
  stage.add(layer);

  let dragging = false;
  let dragMoved = false;
  const DRAG_THRESHOLD = 3;

  const pointerXY = (evt: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    if ('touches' in evt) {
      const t = evt.touches[0] ?? evt.changedTouches[0];
      return t ? { x: t.clientX, y: t.clientY } : null;
    }
    return { x: evt.clientX, y: evt.clientY };
  };

  stage.on('mousedown touchstart', (e) => {
    if (e.target !== stage) return;
    const start = pointerXY(e.evt);
    if (!start) return;
    dragging = true;
    dragMoved = false;
    const layerOrig = { x: layer.x(), y: layer.y() };
    container.style.cursor = 'grabbing';

    const onMove = (moveEvt: MouseEvent | TouchEvent) => {
      const cur = pointerXY(moveEvt);
      if (!cur) return;
      const dx = cur.x - start.x;
      const dy = cur.y - start.y;
      if (!dragMoved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) dragMoved = true;
      layer.position({ x: layerOrig.x + dx, y: layerOrig.y + dy });
    };
    const onUp = () => {
      dragging = false;
      container.style.cursor = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  });

  stage.on('click tap', (e) => {
    if (e.target !== stage) return;
    if (dragMoved) return;
    callbacks.onBackgroundClick();
  });

  stage.on('wheel', (e) => {
    e.evt.preventDefault();
    const oldScale = layer.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const mousePointTo = {
      x: (pointer.x - layer.x()) / oldScale,
      y: (pointer.y - layer.y()) / oldScale,
    };

    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const rawScale = direction > 0 ? oldScale * SCALE_FACTOR : oldScale / SCALE_FACTOR;
    const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, rawScale));

    layer.scale({ x: newScale, y: newScale });
    layer.position({
      x: pointer.x - mousePointTo.x * newScale,
      y: pointer.y - mousePointTo.y * newScale,
    });
  });

  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    const oldW = stage.width();
    const oldH = stage.height();
    if (w === oldW && h === oldH) return;
    stage.size({ width: w, height: h });
    layer.position({
      x: layer.x() + (w - oldW) / 2,
      y: layer.y() + (h - oldH) / 2,
    });
  });
  resizeObserver.observe(container);

  const drawPiece = (
    theme: CanvasTheme,
    coord: HexCoord,
    stack: readonly Piece[],
    movable: Set<string>,
    selectedCoord: string | null,
  ): void => {
    const top = stack[stack.length - 1];
    if (!top) return;
    const p = axialToPixel(coord, HEX_SIZE);
    const key = coordKey(coord);
    const isSelected = key === selectedCoord;
    const isHinted = movable.has(key);
    const stroke = isSelected ? theme.selectStroke : isHinted ? theme.hintStroke : undefined;
    const strokeWidth = isSelected ? 3 : isHinted ? 2 : 0;
    const poly = createHexShape(p, HEX_DRAW_SIZE, HEX_RADIUS, {
      fill: pieceFill(top, theme),
      ...(stroke ? { stroke, strokeWidth } : {}),
    });
    poly.on('click tap', () => callbacks.onPieceClick(coord));
    const text = new Text({
      x: p.x - HEX_SIZE,
      y: p.y - HEX_SIZE,
      width: HEX_SIZE * 2,
      height: HEX_SIZE * 2,
      text: pieceLetter(top.type),
      fontSize: HEX_SIZE,
      fontStyle: 'bold',
      fill: pieceTextColor(top, theme),
      align: 'center',
      verticalAlign: 'middle',
      listening: false,
    });
    layer.add(poly, text);

    if (stack.length > 1) {
      const below = stack[stack.length - 2];
      if (!below) return;
      const chipCenter = { x: p.x + HEX_SIZE * 0.55, y: p.y - HEX_SIZE * 0.65 };
      const chip = createHexShape(chipCenter, CHIP_SIZE, CHIP_RADIUS, {
        fill: pieceFill(below, theme),
        stroke: theme.pieceStroke,
        strokeWidth: 1.5,
        listening: false,
      });
      const chipText = new Text({
        x: chipCenter.x - CHIP_SIZE,
        y: chipCenter.y - CHIP_SIZE,
        width: CHIP_SIZE * 2,
        height: CHIP_SIZE * 2,
        text: pieceLetter(below.type),
        fontSize: CHIP_SIZE,
        fontStyle: 'bold',
        fill: pieceTextColor(below, theme),
        align: 'center',
        verticalAlign: 'middle',
        listening: false,
      });
      layer.add(chip, chipText);
    }
  };

  const draw = (state: StoreState): void => {
    const theme = readTheme();
    layer.destroyChildren();
    const movable = movableOrigins(state);
    const selectedCoord =
      state.selection?.kind === 'board' ? coordKey(state.selection.coord) : null;

    for (const [coord, stack] of occupiedCells(state.game.board)) {
      drawPiece(theme, coord, stack, movable, selectedCoord);
    }

    for (const coord of targetsFor(state)) {
      const p = axialToPixel(coord, HEX_SIZE);
      const poly = createHexShape(p, TARGET_SIZE, TARGET_RADIUS, {
        fill: theme.targetFill,
        stroke: theme.targetStroke,
        strokeWidth: 2,
        dash: [6, 4],
      });
      poly.on('click tap', () => callbacks.onTargetClick(coord));
      layer.add(poly);
    }

    layer.draw();
  };

  const destroy = (): void => {
    resizeObserver.disconnect();
    stage.destroy();
  };

  return { draw, destroy };
};
