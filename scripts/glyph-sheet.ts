// Emits docs/glyph-data.js from the glyphs the app actually draws, so the
// comparison sheet cannot drift from packages/web/src/board/glyphs.ts the way
// docs/piece-icons.html did. Run `pnpm glyphs:sheet` after touching a glyph.
//
// Node runs this file directly: glyphs.ts and pieces.ts import the engine for
// types only, so type stripping leaves nothing to resolve.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PieceType } from '../packages/engine/src/piece.ts';
import { type GlyphShape, glyphShapes } from '../packages/web/src/board/glyphs.ts';
import { type PieceHue, pieceInk } from '../packages/web/src/board/pieces.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GLYPHS = 'packages/web/src/board/glyphs.ts';
const THEME = 'packages/web/src/board/theme.ts';
const OUT = 'docs/glyph-data.js';

const TYPES: readonly PieceType[] = [
  'queen',
  'ant',
  'beetle',
  'spider',
  'grasshopper',
  'ladybug',
  'mosquito',
  'pillbug',
];
const HUES: readonly PieceHue[] = ['shared', 'per-tile', 'mono'];

const read = (rel: string): string => readFileSync(resolve(ROOT, rel), 'utf8');

// Constants the sheet has to agree with to reproduce the app's fit. They are
// module-private in glyphs.ts, so they get lifted rather than re-typed.
const constant = (src: string, name: string): number => {
  const hit = src.match(new RegExp(`const ${name} = ([\\d.]+);`));
  if (hit?.[1] === undefined) throw new Error(`${GLYPHS} no longer declares \`const ${name}\``);
  return Number(hit[1]);
};

const tone = (src: string, name: string): string => {
  const hit = src.match(new RegExp(`cssVar\\('${name}', '(#[0-9a-fA-F]{3,8})'\\)`));
  if (hit?.[1] === undefined) throw new Error(`${THEME} no longer declares a ${name} fallback`);
  return hit[1];
};

// ---------- path round-trip ----------
// Fills are built from four authoring primitives, and the sheet wants their
// parameters back: a radius the sheet can print and compare is worth more than
// the `d` string it was baked into. Each subpath is re-emitted from the numbers
// read out of it and compared, so a parse that guesses wrong fails the build
// instead of quietly reporting fiction.

const round = (v: number): number => Math.round(v * 100) / 100;

const ellipseD = (cx: number, cy: number, rx: number, ry: number, rot: number): string => {
  const rad = (rot * Math.PI) / 180;
  const dx = Math.cos(rad) * rx;
  const dy = Math.sin(rad) * rx;
  const arc = `a${round(rx)} ${round(ry)} ${round(rot)} 1 0`;
  return `M${round(cx - dx)} ${round(cy - dy)}${arc} ${round(2 * dx)} ${round(2 * dy)}${arc} ${round(-2 * dx)} ${round(-2 * dy)}`;
};

const holeD = (cx: number, cy: number, rx: number, ry: number): string =>
  `M${round(cx - rx)} ${round(cy)}a${round(rx)} ${round(ry)} 0 1 1 ${round(2 * rx)} 0a${round(rx)} ${round(ry)} 0 1 1 ${round(-2 * rx)} 0`;

const slotD = (cx: number, cy: number, r: number, half: number): string =>
  `M${round(cx - r)} ${round(cy - half)}A${round(r)} ${round(r)} 0 0 1 ${round(cx + r)} ${round(cy - half)}L${round(cx + r)} ${round(cy + half)}A${round(r)} ${round(r)} 0 0 1 ${round(cx - r)} ${round(cy + half)}Z`;

type Part =
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot: number; cut: false }
  | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number; rot: 0; cut: true }
  | { kind: 'slot'; cx: number; cy: number; r: number; half: number; cut: true };

const N = '(-?[\\d.]+)';
const ELLIPSE = new RegExp(`^M${N} ${N}a${N} ${N} ${N} 1 0 ${N} ${N}a[\\d.\\- ]+$`);
const HOLE = new RegExp(`^M${N} ${N}a${N} ${N} 0 1 1 ${N} 0a[\\d.\\- ]+ 0$`);
const SLOT = new RegExp(`^M${N} ${N}A${N} ${N} 0 0 1 ${N} ${N}L${N} ${N}A.+Z$`);

const parsePart = (d: string): Part => {
  const hole = d.match(HOLE);
  if (hole) {
    const [x, cy, rx, ry] = hole.slice(1).map(Number) as [number, number, number, number];
    return { kind: 'ellipse', cx: x + rx, cy, rx, ry, rot: 0, cut: true };
  }
  const slot = d.match(SLOT);
  if (slot) {
    const [x, top, r] = slot.slice(1).map(Number) as [number, number, number];
    const [, , , , , , , bottom] = slot.slice(1).map(Number);
    if (bottom === undefined) throw new Error(`unreadable slot: ${d}`);
    const half = (bottom - top) / 2;
    return { kind: 'slot', cx: x + r, cy: top + half, r, half, cut: true };
  }
  const arc = d.match(ELLIPSE);
  if (arc) {
    const [x, y, rx, ry, rot, dx2, dy2] = arc.slice(1).map(Number) as [
      number,
      number,
      number,
      number,
      number,
      number,
      number,
    ];
    return { kind: 'ellipse', cx: x + dx2 / 2, cy: y + dy2 / 2, rx, ry, rot, cut: false };
  }
  throw new Error(`no authoring primitive matches this subpath: ${d}`);
};

const emit = (part: Part): string =>
  part.kind === 'slot'
    ? slotD(part.cx, part.cy, part.r, part.half)
    : part.cut
      ? holeD(part.cx, part.cy, part.rx, part.ry)
      : ellipseD(part.cx, part.cy, part.rx, part.ry, part.rot);

const parseFill = (d: string, type: PieceType): readonly Part[] =>
  d
    .split(/(?=M)/)
    .filter((sub) => sub.length > 0)
    .map((sub) => {
      const part = parsePart(sub);
      const again = emit(part);
      if (again !== sub) {
        throw new Error(
          `round-trip mismatch on ${type}\n  authored: ${sub}\n  re-emitted: ${again}`,
        );
      }
      return part;
    });

type WireShape =
  | { kind: 'stroke'; d: string; width: number }
  | { kind: 'fill'; d: string; parts: readonly Part[] };

const toWire = (shape: GlyphShape, type: PieceType): WireShape =>
  shape.kind === 'stroke'
    ? { kind: 'stroke', d: shape.d, width: shape.width }
    : { kind: 'fill', d: shape.d, parts: parseFill(shape.d, type) };

// ---------- emit ----------
const glyphSrc = read(GLYPHS);
const themeSrc = read(THEME);

// The sheet is a file:// page with no stylesheet behind it, so the glyphs need
// the tile tones resolved to hex rather than the var() forms the app uses.
const TONES = {
  pieceWhiteFill: tone(themeSrc, 'piece-white-fill'),
  pieceBlackFill: tone(themeSrc, 'piece-black-fill'),
};

const shapes = Object.fromEntries(
  TYPES.map((type) => [type, glyphShapes(type).map((shape) => toWire(shape, type))]),
);

const ink = Object.fromEntries(
  TYPES.map((type) => [
    type,
    Object.fromEntries(
      HUES.map((hue) => [
        hue,
        {
          white: pieceInk(type, 'white', hue, TONES),
          black: pieceInk(type, 'black', hue, TONES),
        },
      ]),
    ),
  ]),
);

const data = {
  source: GLYPHS,
  box: constant(glyphSrc, 'BOX'),
  margin: constant(glyphSrc, 'MARGIN'),
  hexSize: Number(read('packages/web/src/board/metrics.ts').match(/HEX_SIZE = (\d+)/)?.[1]),
  tiles: { white: TONES.pieceWhiteFill, black: TONES.pieceBlackFill },
  types: TYPES,
  hues: HUES,
  shapes,
  ink,
};

const banner = [
  `// Generated by scripts/glyph-sheet.ts from ${GLYPHS}. Do not edit.`,
  '// Regenerate with `pnpm glyphs:sheet`.',
].join('\n');

writeFileSync(
  resolve(ROOT, OUT),
  `${banner}\nwindow.GLYPH_DATA = ${JSON.stringify(data, null, 2)};\n`,
);

console.log(`${OUT}: ${TYPES.length} glyphs, every fill subpath round-tripped`);
