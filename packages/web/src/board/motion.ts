import 'konva/lib/_CoreInternals.js';
import type { HexCoord, Move } from '@termitary/engine';
import { Animation } from 'konva/lib/Animation.js';
import type { Group } from 'konva/lib/Group.js';
import type { Layer } from 'konva/lib/Layer.js';
import type { StoreState } from '../store/store.js';
import { PLACE_MS, createFlightPath, liftPlanner, placeScaleAt } from './flight.js';
import { axialToPixel } from './hex.js';
import { HEX_SIZE } from './metrics.js';

/**
 * What the overlay does to its one node over `durationMs`, for a t of 0..1.
 * `coord` is the cell the piece is arriving at, which the board must leave
 * empty until it does.
 */
export type Motion = {
  readonly coord: HexCoord;
  readonly durationMs: number;
  readonly apply: (node: Group, t: number) => void;
};

// Read per move rather than once, so flipping the OS setting takes effect
// without a reload.
const reducedMotion = (): boolean => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The move that history just gained, or null when it gained nothing it can
 * animate. Exactly one new entry means a move landed and we know which.
 * Anything else is a rollback, a server echo, or a fresh join, and snaps.
 */
export const appendedMove = (before: StoreState, after: StoreState): Move | null => {
  const history = after.view.history;
  if (history.length !== before.view.history.length + 1) return null;
  return history[history.length - 1] ?? null;
};

export const planMotion = (before: StoreState | null, after: StoreState): Motion | null => {
  if (before === null || reducedMotion()) return null;
  const move = appendedMove(before, after);
  if (move === null || move.kind === 'pass') return null;

  if (move.kind === 'place') {
    const at = axialToPixel(move.to, HEX_SIZE);
    return {
      coord: move.to,
      durationMs: PLACE_MS,
      apply: (node, t) => {
        const scale = placeScaleAt(t);
        node.position(at);
        node.scale({ x: scale, y: scale });
        node.opacity(t);
      },
    };
  }

  const flight = liftPlanner(move, before.view.board);
  const path = createFlightPath(flight);
  return {
    coord: move.to,
    durationMs: flight.durationMs,
    apply: (node, t) => {
      const scale = path.scaleAt(t);
      node.position(path.positionAt(t));
      node.scale({ x: scale, y: scale });
    },
  };
};

export type MotionRunner = {
  readonly start: (motion: Motion, node: Group) => void;
  /** Ends the motion without finishing it. The node vanishes; the board keeps it. */
  readonly stop: () => void;
  /** The cell the board must leave empty, or null when nothing is in transit. */
  readonly arrivingAt: () => HexCoord | null;
};

/**
 * Drives one node on the overlay layer. `onSettled` fires after a motion
 * reaches t=1, for the repaint that puts the piece back on the board.
 */
export const createMotionRunner = (overlay: Layer, onSettled: () => void): MotionRunner => {
  let active: { readonly coord: HexCoord; readonly node: Group; readonly anim: Animation } | null =
    null;

  const stop = (): void => {
    if (active === null) return;
    active.anim.stop();
    active.node.destroy();
    active = null;
    overlay.batchDraw();
  };

  const start = (motion: Motion, node: Group): void => {
    const anim = new Animation((frame) => {
      const t = Math.min(1, (frame?.time ?? 0) / motion.durationMs);
      motion.apply(node, t);
      if (t < 1) return;
      stop();
      onSettled();
    }, overlay);
    active = { coord: motion.coord, node, anim };
    motion.apply(node, 0);
    overlay.add(node);
    anim.start();
  };

  return { start, stop, arrivingAt: () => active?.coord ?? null };
};
