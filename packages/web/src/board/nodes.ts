import 'konva/lib/_CoreInternals.js';
import type { Piece, PieceType } from '@termitary/engine';
import { Group } from 'konva/lib/Group.js';
import type { Shape } from 'konva/lib/Shape.js';
import { Path } from 'konva/lib/shapes/Path.js';
import { Text } from 'konva/lib/shapes/Text.js';
import { type Pixel, createHexShape } from './hex.js';
import {
  CHIP_RADIUS,
  CHIP_SIZE,
  HEX_DRAW_SIZE,
  HEX_RADIUS,
  TARGET_DASH,
  TARGET_RADIUS,
  TARGET_SIZE,
} from './metrics.js';
import { type Mark, type PieceSet, markFor } from './piece-sets.js';
import { type PieceHue, pieceFill, pieceGhostInk, pieceInk } from './pieces.js';
import type { CanvasTheme } from './theme.js';

const GHOST_OPACITY = 0.7;
const ORIGIN: Pixel = { x: 0, y: 0 };

/** Everything a tile needs to know about how it should look. */
export type Skin = {
  readonly theme: CanvasTheme;
  readonly set: PieceSet;
  readonly hue: PieceHue;
};

export type Outline = { readonly stroke: string; readonly strokeWidth: number };

// Konva's node tree for one mark. A set says what to draw; only the primitives
// are this module's business.
const markNode = (mark: Mark, ink: string, center: Pixel): Group | Text => {
  if (mark.kind === 'text') {
    return new Text({
      x: center.x - mark.fontSize,
      y: center.y - mark.fontSize,
      width: mark.fontSize * 2,
      height: mark.fontSize * 2,
      text: mark.text,
      fontFamily: mark.font,
      fontSize: mark.fontSize,
      fontStyle: 'bold',
      fill: ink,
      align: 'center',
      verticalAlign: 'middle',
      // Konva centres the em box; offsetY moves the node down onto the ink.
      offsetY: -mark.dy,
      listening: false,
    });
  }
  const group = new Group({
    x: center.x,
    y: center.y,
    scaleX: mark.scale,
    scaleY: mark.scale,
    offsetX: mark.cx,
    offsetY: mark.cy,
    listening: false,
  });
  for (const shape of mark.shapes) {
    group.add(
      new Path({
        data: shape.d,
        ...(shape.kind === 'fill'
          ? { fill: ink }
          : {
              stroke: ink,
              strokeWidth: shape.width,
              lineCap: 'round' as const,
              lineJoin: 'round' as const,
            }),
        listening: false,
      }),
    );
  }
  return group;
};

// Traced around its own origin, so the caller positions the node rather than
// the outline. That is what lets one builder serve a settled tile and a tile in
// flight.
const tileNode = (
  skin: Skin,
  piece: Piece,
  size: number,
  radius: number,
  outline: Outline | null,
): Group => {
  const group = new Group();
  group.add(
    createHexShape(ORIGIN, size, radius, {
      fill: pieceFill(piece, skin.theme),
      ...(outline ?? {}),
    }),
  );
  group.add(
    markNode(markFor(skin.set, piece.type, size), pieceInk(piece.type, piece.color, skin.hue), {
      x: 0,
      y: 0,
    }),
  );
  return group;
};

/** A full-size tile: the top of a stack, or the piece the overlay is flying. */
export const pieceTile = (skin: Skin, piece: Piece, outline: Outline | null): Group =>
  tileNode(skin, piece, HEX_DRAW_SIZE, HEX_RADIUS, outline);

/** The corner chip that shows what a beetle is standing on. */
export const chipTile = (skin: Skin, piece: Piece): Group => {
  const chip = tileNode(skin, piece, CHIP_SIZE, CHIP_RADIUS, {
    stroke: skin.theme.pieceStroke,
    strokeWidth: 1.5,
  });
  chip.listening(false);
  return chip;
};

/**
 * The piece that would land on the cell under the cursor. Hover is
 * single-pointer, so one ghost moves between targets: one per target would
 * rasterise the same glyph dozens of times for a piece with many legal moves.
 *
 * Cache it once it is on a layer. Konva multiplies a group's opacity into every
 * child, so without caching the legs show through the body where they overlap.
 */
export const ghostNode = (skin: Skin, type: PieceType): Group => {
  const ghost = new Group({ opacity: GHOST_OPACITY, visible: false, listening: false });
  ghost.add(markNode(markFor(skin.set, type, TARGET_SIZE), pieceGhostInk(type), ORIGIN));
  return ghost;
};

export const targetShape = (theme: CanvasTheme, center: Pixel): Shape =>
  createHexShape(center, TARGET_SIZE, TARGET_RADIUS, {
    fill: theme.targetFill,
    stroke: theme.targetStroke,
    strokeWidth: 2,
    dash: [...TARGET_DASH.pattern],
    dashOffset: TARGET_DASH.offset,
  });

// Konva has no CSS :hover, so both directions are manual. Dashed and faint
// means "legal"; solid, filled and carrying the piece glyph means "this is the
// cell a click commits to".
export const styleTarget = (poly: Shape, theme: CanvasTheme, hovered: boolean): void => {
  poly.fill(hovered ? theme.targetFillActive : theme.targetFill);
  poly.stroke(hovered ? theme.targetStrokeActive : theme.targetStroke);
  poly.strokeWidth(hovered ? 3 : 2);
  poly.dash(hovered ? [] : [...TARGET_DASH.pattern]);
};
