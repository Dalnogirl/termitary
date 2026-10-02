import 'konva/lib/_CoreInternals.js';
import type { HexCoord } from '@termitary/engine';
import { Group } from 'konva/lib/Group.js';
import type { Layer } from 'konva/lib/Layer.js';
import { Circle } from 'konva/lib/shapes/Circle.js';
import { Line } from 'konva/lib/shapes/Line.js';
import { Path } from 'konva/lib/shapes/Path.js';
import { Rect } from 'konva/lib/shapes/Rect.js';
import type { Annotation } from '../store/annotations.js';
import { axialToPixel, createHexShape, sharedEdge } from './hex.js';
import { HEX_DRAW_SIZE, HEX_RADIUS, HEX_SIZE } from './metrics.js';
import { type CanvasTheme, readTheme } from './theme.js';

const CROSS_ARM = HEX_SIZE * 0.32;
const BADGE_RADIUS = 9;
// Opposite the beetle's chip, so a pinned beetle shows both.
const BADGE_OFFSET = { x: HEX_SIZE * 0.55, y: HEX_SIZE * 0.65 } as const;

const at = (coord: HexCoord) => ({ ...axialToPixel(coord, HEX_SIZE), q: coord.q, r: coord.r });

const padlock = (theme: CanvasTheme): Group => {
  const lock = new Group();
  lock.add(
    new Path({
      data: 'M -2.5 -1 V -3 A 2.5 2.5 0 0 1 2.5 -3 V -1',
      stroke: theme.pieceWhiteFill,
      strokeWidth: 1.5,
    }),
    new Rect({ x: -4, y: -1, width: 8, height: 6, cornerRadius: 1, fill: theme.pieceWhiteFill }),
  );
  return lock;
};

// A ring rather than a wash, because a wash is how the board dims everything
// a selection leaves out, and the two stacked over a pinned bystander.
const pinnedNode = (theme: CanvasTheme, coord: HexCoord): Group => {
  const group = new Group({ name: 'pinned', ...at(coord) });
  group.add(
    createHexShape({ x: 0, y: 0 }, HEX_DRAW_SIZE, HEX_RADIUS, {
      stroke: theme.refuseStroke,
      strokeWidth: 3,
    }),
  );
  const badge = new Group(BADGE_OFFSET);
  badge.add(new Circle({ radius: BADGE_RADIUS, fill: theme.refuseStroke }), padlock(theme));
  group.add(badge);
  return group;
};

const blockedNode = (theme: CanvasTheme, coord: HexCoord): Group => {
  const group = new Group({ name: 'blocked', ...at(coord) });
  const arm = { stroke: theme.refuseStroke, strokeWidth: 4, lineCap: 'round' as const };
  group.add(
    new Line({ points: [-CROSS_ARM, -CROSS_ARM, CROSS_ARM, CROSS_ARM], ...arm }),
    new Line({ points: [-CROSS_ARM, CROSS_ARM, CROSS_ARM, -CROSS_ARM], ...arm }),
  );
  return group;
};

const gateNode = (theme: CanvasTheme, [a, b]: readonly [HexCoord, HexCoord]): Line | null => {
  const edge = sharedEdge(a, b, HEX_SIZE);
  if (edge === null) return null;
  const [from, to] = edge;
  return new Line({
    name: 'gate',
    points: [from.x, from.y, to.x, to.y],
    stroke: theme.refuseStroke,
    strokeWidth: 6,
    lineCap: 'round',
    q: a.q,
    r: a.r,
    q2: b.q,
    r2: b.r,
  });
};

const annotationNode = (theme: CanvasTheme, annotation: Annotation): Group | Line | null => {
  switch (annotation.kind) {
    case 'pinned':
      return pinnedNode(theme, annotation.at);
    case 'blocked':
      return blockedNode(theme, annotation.at);
    case 'gate':
      return gateNode(theme, annotation.between);
  }
};

export const paintAnnotations = (layer: Layer, annotations: readonly Annotation[]): void => {
  const theme = readTheme();
  layer.destroyChildren();
  for (const annotation of annotations) {
    const node = annotationNode(theme, annotation);
    if (node !== null) layer.add(node);
  }
  layer.draw();
};
