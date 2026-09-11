import type { PieceType } from '@hive/engine';

export type GlyphShape =
  | { readonly kind: 'fill'; readonly d: string }
  | { readonly kind: 'stroke'; readonly d: string; readonly width: number };

// Every glyph is authored in this box, then fitted to whatever tile draws it.
const BOX = 100;

type Pt = readonly [number, number];

const round = (v: number): number => Math.round(v * 100) / 100;

const ellipse = (cx: number, cy: number, rx: number, ry: number, rot = 0): string => {
  const rad = (rot * Math.PI) / 180;
  const dx = Math.cos(rad) * rx;
  const dy = Math.sin(rad) * rx;
  const arc = `a${round(rx)} ${round(ry)} ${round(rot)} 1 0`;
  return `M${round(cx - dx)} ${round(cy - dy)}${arc} ${round(2 * dx)} ${round(2 * dy)}${arc} ${round(-2 * dx)} ${round(-2 * dy)}`;
};

const circle = (cx: number, cy: number, r: number): string => ellipse(cx, cy, r, r);

const line = (pts: readonly Pt[]): string =>
  pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`).join('');

const mirrorPts = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [BOX - x, y] as const);

const fill = (...ds: readonly string[]): GlyphShape => ({ kind: 'fill', d: ds.join('') });

const stroke = (width: number, ...ds: readonly string[]): GlyphShape => ({
  kind: 'stroke',
  width,
  d: ds.join(''),
});

// Authored once on the left and mirrored, so a bug stays symmetric when one leg
// moves.
const bothSides = (width: number, ...runs: readonly (readonly Pt[])[]): GlyphShape =>
  stroke(width, ...runs.flatMap((r) => [line(r), line(mirrorPts(r))]));

// Fewer, fatter parts than an anatomical drawing, built to survive the 14px
// chip. The walkers' legs bend once at a knee, which is most of what makes them
// read as legs instead of spokes. Two pieces break the top-down view on purpose:
// the grasshopper is in profile, because from above its folded hind legs make
// the same wide V as a spider's leg splay, and the beetle carries short forward
// horns against the ant's thin straight antennae, which is the only thing
// keeping those two apart at chip size.
const CHUNKY: Record<PieceType, readonly GlyphShape[]> = {
  queen: [
    bothSides(5, [
      [46, 20],
      [38, 6],
    ]),
    fill(ellipse(74, 44, 8, 19, -20), ellipse(26, 44, 8, 19, 20)),
    fill(ellipse(50, 68, 16, 21), ellipse(50, 38, 13, 14), ellipse(50, 18, 10, 9)),
  ],
  ant: [
    bothSides(5, [
      [46, 18],
      [38, 5],
    ]),
    bothSides(
      5,
      [
        [42, 38],
        [22, 26],
        [16, 14],
      ],
      [
        [41, 48],
        [18, 44],
        [12, 53],
      ],
      [
        [42, 58],
        [22, 72],
        [16, 84],
      ],
    ),
    fill(ellipse(50, 74, 15, 18), ellipse(50, 47, 10, 12), ellipse(50, 24, 11, 10)),
  ],
  beetle: [
    bothSides(
      5,
      [
        [39, 44],
        [23, 35],
        [20, 22],
      ],
      [
        [36, 59],
        [16, 56],
        [11, 64],
      ],
      [
        [39, 74],
        [23, 82],
        [20, 90],
      ],
    ),
    stroke(7, 'M41 28C32 20 34 10 45 8', 'M59 28C68 20 66 10 55 8'),
    fill(ellipse(50, 64, 23, 24), ellipse(50, 34, 14, 10)),
  ],
  spider: [
    bothSides(
      4.5,
      [
        [58, 34],
        [80, 16],
        [70, 7],
      ],
      [
        [61, 42],
        [87, 30],
        [85, 17],
      ],
      [
        [61, 52],
        [87, 64],
        [85, 77],
      ],
      [
        [58, 60],
        [80, 78],
        [70, 87],
      ],
    ),
    fill(ellipse(50, 64, 22, 24), ellipse(50, 36, 13, 13)),
  ],
  grasshopper: [
    stroke(
      5.5,
      line([
        [34, 66],
        [28, 86],
      ]),
      line([
        [48, 66],
        [44, 86],
      ]),
    ),
    stroke(
      6,
      line([
        [85, 26],
        [90, 64],
      ]),
      line([
        [90, 64],
        [78, 80],
      ]),
    ),
    fill(ellipse(73, 42, 20, 7, -54)),
    fill(ellipse(47, 56, 25, 13, -8)),
    fill(circle(16, 58, 11)),
    stroke(4.5, 'M10 48C15 28 36 20 54 22'),
  ],
};

export const glyphShapes = (type: PieceType): readonly GlyphShape[] => CHUNKY[type];

const SVG_NS = 'http://www.w3.org/2000/svg';
const APOTHEM = Math.sqrt(3) / 2;
// Clear space between the glyph's ink and the nearest hex edge, in box units.
const MARGIN = 9;

type InkBox = { readonly x: number; readonly y: number; readonly w: number; readonly h: number };

let measureSvg: SVGSVGElement | null = null;

// getBBox reports nothing for a path outside the render tree, so the scratch SVG
// has to be in the document, just off-screen.
const measureRoot = (): SVGSVGElement => {
  if (measureSvg === null) {
    measureSvg = document.createElementNS(SVG_NS, 'svg');
    measureSvg.setAttribute('width', '200');
    measureSvg.setAttribute('height', '200');
    measureSvg.setAttribute('style', 'position:fixed;left:-9999px;top:0');
    document.body.appendChild(measureSvg);
  }
  return measureSvg;
};

const inkBox = (shapes: readonly GlyphShape[]): InkBox => {
  const root = measureRoot();
  let x0 = Number.POSITIVE_INFINITY;
  let y0 = Number.POSITIVE_INFINITY;
  let x1 = Number.NEGATIVE_INFINITY;
  let y1 = Number.NEGATIVE_INFINITY;
  for (const shape of shapes) {
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', shape.d);
    root.appendChild(path);
    const b = path.getBBox();
    root.removeChild(path);
    const pad = shape.kind === 'stroke' ? shape.width / 2 : 0;
    x0 = Math.min(x0, b.x - pad);
    y0 = Math.min(y0, b.y - pad);
    x1 = Math.max(x1, b.x + b.width + pad);
    y1 = Math.max(y1, b.y + b.height + pad);
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

// A pointy-top hexagon is 13% narrower across the flats than across the points,
// so scaling a glyph to its bounding box leaves the wide ones touching the edge
// while the tall ones float. This is the largest scale at which the ink box,
// centred, still clears all six edges by MARGIN.
const hexFit = (box: InkBox): number => {
  const hw = box.w / 2;
  const hh = box.h / 2;
  const room = (BOX / 2) * APOTHEM - MARGIN;
  return room / Math.max(hw, 0.5 * hw + APOTHEM * hh);
};

export type GlyphPlacement = {
  /** Uniform scale from box units to pixels. */
  readonly scale: number;
  /** The ink centre, in box units, to draw the glyph about. */
  readonly cx: number;
  readonly cy: number;
};

const placements = new Map<PieceType, GlyphPlacement>();

// Measured once per glyph and cached: edit a glyph and its fit follows, without
// anyone porting a number by hand.
const unitPlacement = (type: PieceType): GlyphPlacement => {
  const cached = placements.get(type);
  if (cached !== undefined) return cached;
  const box = inkBox(CHUNKY[type]);
  const fitted: GlyphPlacement = {
    scale: hexFit(box),
    cx: box.x + box.w / 2,
    cy: box.y + box.h / 2,
  };
  placements.set(type, fitted);
  return fitted;
};

/** Placement for a glyph drawn centred on a hexagon of the given circumradius. */
export const glyphPlacement = (type: PieceType, hexSize: number): GlyphPlacement => {
  const unit = unitPlacement(type);
  return { ...unit, scale: (unit.scale * hexSize) / (BOX / 2) };
};
