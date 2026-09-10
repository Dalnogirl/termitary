import { hexDash } from './hex.js';

// Shared by the interactive board and the static clusters on the home page, so
// a piece drawn outside the game looks like the same piece.
export const HEX_SIZE = 40;
export const HEX_DRAW_SIZE = 38;
export const HEX_RADIUS = 7;
export const TARGET_SIZE = 36;
export const TARGET_RADIUS = 6;
export const CHIP_SIZE = 14;
export const CHIP_RADIUS = 3;

// Konva's Text default. Canvas 2D has no such default, so the static clusters
// have to name it to match.
export const PIECE_FONT = 'Arial';

// Fitted once so the board and the static clusters dash a target identically.
export const TARGET_DASH = hexDash(TARGET_SIZE, TARGET_RADIUS, 6, 4);
