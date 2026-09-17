import 'konva/lib/_CoreInternals.js';
import { Layer } from 'konva/lib/Layer.js';
import { Stage } from 'konva/lib/Stage.js';
import type { Pixel } from './hex.js';

const SCALE_MIN = 0.4;
const SCALE_MAX = 3;
const SCALE_FACTOR = 1.1;
const DRAG_THRESHOLD = 3;

export type View = {
  /** The hive, rebuilt on every draw. */
  readonly board: Layer;
  /** One node at a time: the piece in transit. */
  readonly overlay: Layer;
  readonly setHoverCursor: (value: string) => void;
  readonly destroy: () => void;
};

const pointerXY = (evt: MouseEvent | TouchEvent): Pixel | null => {
  if ('touches' in evt) {
    const t = evt.touches[0] ?? evt.changedTouches[0];
    return t ? { x: t.clientX, y: t.clientY } : null;
  }
  return { x: evt.clientX, y: evt.clientY };
};

const touchDistance = (a: Touch, b: Touch): number =>
  Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);

const clampScale = (scale: number): number => Math.max(SCALE_MIN, Math.min(SCALE_MAX, scale));

/**
 * Owns the stage, its two layers, and every gesture that moves them. Built once
 * and outlives every draw, so nothing here reads game state.
 */
export const createView = (container: HTMLDivElement, onClearSelection: () => void): View => {
  // Disable native touch gestures on the canvas so our pinch handler is the
  // sole zoom source. Konva binds touch listeners passively, so preventDefault
  // inside them is a no-op — touch-action is the only working mute.
  container.style.touchAction = 'none';
  const stage = new Stage({
    container,
    width: container.clientWidth || 800,
    height: container.clientHeight || 600,
  });
  const board = new Layer({ x: stage.width() / 2, y: stage.height() / 2 });
  // Its own canvas, so a flight costs one small repaint a frame instead of
  // redrawing the whole hive.
  const overlay = new Layer({ x: board.x(), y: board.y(), listening: false });
  stage.add(board, overlay);

  // The overlay tracks the board's transform, or a flight detaches from the
  // hive the moment you pan or zoom.
  const positionView = (pos: Pixel): void => {
    board.position(pos);
    overlay.position(pos);
  };
  const scaleView = (scale: number): void => {
    board.scale({ x: scale, y: scale });
    overlay.scale({ x: scale, y: scale });
  };

  let dragging = false;
  let dragMoved = false;
  let pinching = false;
  let lastPinchDist = 0;
  let cancelPan: (() => void) | null = null;

  // Pan owns the cursor while it is active; hover must not fight it for the
  // grabbing state.
  const setHoverCursor = (value: string): void => {
    if (dragging || pinching) return;
    container.style.cursor = value;
  };

  stage.on('mousedown touchstart', (e) => {
    if (e.target !== stage) return;
    if ('button' in e.evt && e.evt.button !== 0) return;
    // Multi-touch defers to the pinch handler below.
    if ('touches' in e.evt && e.evt.touches.length > 1) return;
    const start = pointerXY(e.evt);
    if (!start) return;
    dragging = true;
    dragMoved = false;
    const origin = { x: board.x(), y: board.y() };
    container.style.cursor = 'grabbing';

    const onMove = (moveEvt: MouseEvent | TouchEvent) => {
      if (pinching) return;
      const cur = pointerXY(moveEvt);
      if (!cur) return;
      const dx = cur.x - start.x;
      const dy = cur.y - start.y;
      if (!dragMoved && Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD) dragMoved = true;
      positionView({ x: origin.x + dx, y: origin.y + dy });
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
    // stale origin reference.
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
    const oldScale = board.scaleX();
    const newScale = clampScale(oldScale * (newDist / lastPinchDist));
    const rect = stage.container().getBoundingClientRect();
    const cx = (t1.clientX + t2.clientX) / 2 - rect.left;
    const cy = (t1.clientY + t2.clientY) / 2 - rect.top;
    const pointTo = {
      x: (cx - board.x()) / oldScale,
      y: (cy - board.y()) / oldScale,
    };
    scaleView(newScale);
    positionView({
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
    onClearSelection();
  });

  // Right click puts down whatever is held, over a piece as readily as over a
  // gap, so backing out never means hunting for empty board. Touch has no such
  // gesture, which is why the tap above stays the one every device has.
  stage.on('contextmenu', (e) => {
    e.evt.preventDefault();
    onClearSelection();
  });

  stage.on('wheel', (e) => {
    e.evt.preventDefault();
    const oldScale = board.scaleX();
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const pointTo = {
      x: (pointer.x - board.x()) / oldScale,
      y: (pointer.y - board.y()) / oldScale,
    };
    const newScale = clampScale(
      e.evt.deltaY > 0 ? oldScale / SCALE_FACTOR : oldScale * SCALE_FACTOR,
    );

    scaleView(newScale);
    positionView({
      x: pointer.x - pointTo.x * newScale,
      y: pointer.y - pointTo.y * newScale,
    });
  });

  const resizeObserver = new ResizeObserver(() => {
    const w = container.clientWidth || 800;
    const h = container.clientHeight || 600;
    const oldW = stage.width();
    const oldH = stage.height();
    if (w === oldW && h === oldH) return;
    stage.size({ width: w, height: h });
    positionView({
      x: board.x() + (w - oldW) / 2,
      y: board.y() + (h - oldH) / 2,
    });
  });
  resizeObserver.observe(container);

  const destroy = (): void => {
    resizeObserver.disconnect();
    stage.destroy();
  };

  return { board, overlay, setHoverCursor, destroy };
};
