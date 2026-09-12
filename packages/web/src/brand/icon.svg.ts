import { ICON_GAP, moundPath, moundViewBox } from './mound.js';

const LATTICE = 40;
// The board's ivory, hardcoded because a favicon has no cascade to read it from.
const INK = '#E9E2D2';

export const ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${moundViewBox(
  LATTICE,
  ICON_GAP,
  2,
)}" fill="${INK}"><path d="${moundPath(LATTICE, ICON_GAP)}"/></svg>\n`;
