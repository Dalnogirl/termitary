// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { pieceGhostInk, pieceInk } from './pieces.js';
import { readTheme } from './theme.js';

const theme = readTheme();

describe('pieceInk', () => {
  it('inks a mono piece in the other player’s tile tone', () => {
    expect(pieceInk('queen', 'white', 'mono', theme)).toBe(theme.pieceBlackFill);
    expect(pieceInk('ant', 'black', 'mono', theme)).toBe(theme.pieceWhiteFill);
  });

  it('keeps the hues apart from mono', () => {
    expect(pieceInk('queen', 'white', 'shared', theme)).not.toBe(
      pieceInk('queen', 'white', 'mono', theme),
    );
    expect(pieceGhostInk('queen', 'mono', theme)).toBe(theme.pieceWhiteFill);
  });
});
