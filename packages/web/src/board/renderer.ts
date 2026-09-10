import 'konva/lib/_CoreInternals.js';
import { type Color, type HexCoord, type Piece, occupiedCells, topPieceAt } from '@hive/engine';
import { Layer } from 'konva/lib/Layer.js';
import { Stage } from 'konva/lib/Stage.js';
import { Text } from 'konva/lib/shapes/Text.js';
import type { StoreState } from '../store/store.js';
import { axialToPixel, createHexShape } from './hex.js';
import {
  CHIP_RADIUS,
  CHIP_SIZE,
  HEX_DRAW_SIZE,
  HEX_RADIUS,
  HEX_SIZE,
  TARGET_DASH,
  TARGET_RADIUS,
  TARGET_SIZE,
} from './metrics.js';
import { pieceFill, pieceLetter, pieceTextColor } from './pieces.js';
import { type CanvasTheme, readTheme } from './theme.js';

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

const movableOrigins = (state: StoreState, myColor: Color | null): Set<string> => {
  const out = new Set<string>();
  // In network play, only highlight my pieces. When it's the opponent's turn,
  // validMoves describes THEIR options — show no highlights at all. The input
  // handlers apply the same gate, so this is a presentation-mirror of intent.
  if (
    myColor !== null &&
    state.game.status === 'in_progress' &&
    state.game.currentPlayer !== myColor
  ) {
    return out;
  }
  for (const m of state.validMoves) {
    if (m.kind === 'relocate') out.add(coordKey(m.from));
  }
  return out;
};

// The letter that would appear on a target cell if the pending move committed.
// Drives the hover ghost, so the player sees what lands, not just where.
const landingLetter = (state: StoreState): string | null => {
  const sel = state.selection;
  if (sel === null) return null;
  if (sel.kind === 'hand') return pieceLetter(sel.piece);
  const top = topPieceAt(state.game.board, sel.coord);
  return top === undefined ? null : pieceLetter(top.type);
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

export type RendererOptions = {
  readonly myColor: Color | null;
};

export const createRenderer = (
  container: HTMLDivElement,
  callbacks: RendererCallbacks,
  options: RendererOptions,
): Renderer => {
  // Disable native touch gestures on the canvas so our pinch handler is the
  // sole zoom source. Konva binds touch listeners passively, so preventDefault
  // inside them is a no-op — touch-action is the only working mute.
  container.style.touchAction = 'none';
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
  let pinching = false;
  let lastPinchDist = 0;
  let cancelPan: (() => void) | null = null;

  // Pan owns the cursor while it is active; hover must not fight it for the
  // grabbing state.
  const setHoverCursor = (value: string): void => {
    if (dragging || pinching) return;
    container.style.cursor = value;
  };

  const pointerXY = (evt: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    if ('touches' in evt) {
      const t = evt.touches[0] ?? evt.changedTouches[0];
      return t ? { x: t.clientX, y: t.clientY } : null;
    }
    return { x: evt.clientX, y: evt.clientY };
  };

  const touchDistance = (a: Touch, b: Touch): number =>
    Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

  stage.on('mousedown touchstart', (e) => {
    if (e.target !== stage) return;
    // Multi-touch defers to the pinch handler below.
    if ('touches' in e.evt && e.evt.touches.length > 1) return;
    const start = pointerXY(e.evt);
    if (!start) return;
    dragging = true;
    dragMoved = false;
    const layerOrig = { x: layer.x(), y: layer.y() };
    container.style.cursor = 'grabbing';

    const onMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (pinching) return;
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
      cancelPan = null;
    };
    cancelPan = onUp;
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    window.addEventListener('touchmove', onMove);
    window.addEventListener('touchend', onUp);
  });

  stage.on('touchstart', (e) => {
    if (e.evt.touches.length < 2) return;
    // Hard-cancel any in-flight pan so its onMove stops fighting us. We also
    // gate that onMove on `pinching`, but cancelling fully avoids a positional
    // jump when the second finger lifts and pan would otherwise resume from a
    // stale layerOrig reference.
    cancelPan?.();
    pinching = true;
    dragMoved = true; // suppress the click/tap that follows a pinch
    const [t1, t2] = [e.evt.touches[0], e.evt.touches[1]];
    if (!t1 || !t2) return;
    lastPinchDist = touchDistance(t1, t2);
    e.evt.preventDefault();
  });

  stage.on('touchmove', (e) => {
    if (!pinching || e.evt.touches.length < 2) return;
    const [t1, t2] = [e.evt.touches[0], e.evt.touches[1]];
    if (!t1 || !t2) return;
    e.evt.preventDefault();
    const newDist = touchDistance(t1, t2);
    if (lastPinchDist <= 0) {
      lastPinchDist = newDist;
      return;
    }
    const oldScale = layer.scaleX();
    const rawScale = oldScale * (newDist / lastPinchDist);
    const newScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, rawScale));
    const rect = stage.container().getBoundingClientRect();
    const cx = (t1.clientX + t2.clientX) / 2 - rect.left;
    const cy = (t1.clientY + t2.clientY) / 2 - rect.top;
    const pointTo = {
      x: (cx - layer.x()) / oldScale,
      y: (cy - layer.y()) / oldScale,
    };
    layer.scale({ x: newScale, y: newScale });
    layer.position({
      x: cx - pointTo.x * newScale,
      y: cy - pointTo.y * newScale,
    });
    lastPinchDist = newDist;
  });

  stage.on('touchend touchcancel', (e) => {
    if (e.evt.touches.length < 2) {
      pinching = false;
      lastPinchDist = 0;
      // Pinches that end on a child node never re-enter the pan-start handler,
      // so the dragMoved=true we set on pinch start would persist and suppress
      // the next stage tap. Reset here.
      dragMoved = false;
    }
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
    if (isSelected || isHinted) {
      poly.on('mouseenter', () => setHoverCursor('pointer'));
      poly.on('mouseleave', () => setHoverCursor(''));
    }
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

  const drawTarget = (theme: CanvasTheme, coord: HexCoord, ghost: string | null): void => {
    const p = axialToPixel(coord, HEX_SIZE);
    const poly = createHexShape(p, TARGET_SIZE, TARGET_RADIUS, {
      fill: theme.targetFill,
      stroke: theme.targetStroke,
      strokeWidth: 2,
      dash: [...TARGET_DASH.pattern],
      dashOffset: TARGET_DASH.offset,
    });
    poly.on('click tap', () => callbacks.onTargetClick(coord));

    const ghostText =
      ghost === null
        ? null
        : new Text({
            x: p.x - HEX_SIZE,
            y: p.y - HEX_SIZE,
            width: HEX_SIZE * 2,
            height: HEX_SIZE * 2,
            text: ghost,
            fontSize: HEX_SIZE * 0.78,
            fontStyle: 'bold',
            fill: theme.targetGhost,
            align: 'center',
            verticalAlign: 'middle',
            listening: false,
            visible: false,
          });

    // Konva has no CSS :hover, so both directions are manual and each has to
    // repaint. Dashed and faint means "legal"; solid, filled and carrying the
    // piece letter means "this is the cell a click commits to".
    poly.on('mouseenter', () => {
      poly.fill(theme.targetFillActive);
      poly.stroke(theme.targetStrokeActive);
      poly.strokeWidth(3);
      poly.dash([]);
      ghostText?.visible(true);
      setHoverCursor('pointer');
      layer.batchDraw();
    });
    poly.on('mouseleave', () => {
      poly.fill(theme.targetFill);
      poly.stroke(theme.targetStroke);
      poly.strokeWidth(2);
      poly.dash([...TARGET_DASH.pattern]);
      ghostText?.visible(false);
      setHoverCursor('');
      layer.batchDraw();
    });

    layer.add(poly);
    if (ghostText !== null) layer.add(ghostText);
  };

  const draw = (state: StoreState): void => {
    const theme = readTheme();
    // destroyChildren removes the hovered node without firing mouseleave, so
    // the pointer cursor would stick after a move commits.
    setHoverCursor('');
    layer.destroyChildren();
    const movable = movableOrigins(state, options.myColor);
    const selectedCoord =
      state.selection?.kind === 'board' ? coordKey(state.selection.coord) : null;

    for (const [coord, stack] of occupiedCells(state.game.board)) {
      drawPiece(theme, coord, stack, movable, selectedCoord);
    }

    const ghost = landingLetter(state);
    for (const coord of targetsFor(state)) {
      drawTarget(theme, coord, ghost);
    }

    layer.draw();
  };

  const destroy = (): void => {
    resizeObserver.disconnect();
    stage.destroy();
  };

  return { draw, destroy };
};
