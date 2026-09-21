import { type Page, expect } from '@playwright/test';
import type { Board, HexCoord, Move } from '@termitary/engine';
import { topPieceAt } from '@termitary/engine';
import { type DrawnPiece, clickCell, hitAt, pieceAt } from './board.js';

/** What the board should be showing at `coord` once `after` is on screen. */
export const drawnAt = (after: Board, coord: HexCoord): DrawnPiece => {
  const top = topPieceAt(after, coord);
  if (top === undefined) throw new Error(`nothing stands at ${JSON.stringify(coord)}`);
  return { color: top.color, type: top.type };
};

export const expectPieceAt = async (
  page: Page,
  coord: HexCoord,
  piece: DrawnPiece,
): Promise<void> => {
  await expect.poll(() => pieceAt(page, coord)).toEqual(piece);
};

/** The move kinds a player commits with two clicks, which is all the fixture has. */
export type DrivableMove = Extract<Move, { kind: 'place' | 'relocate' }>;

export const drivable = (move: Move): DrivableMove => {
  if (move.kind === 'place' || move.kind === 'relocate') return move;
  throw new Error(`the fixture plays no ${move.kind}`);
};

/**
 * One move, played the way a player plays it: pick the piece up, then put it
 * down. The wait between the two halves is the board offering the cell, which
 * is also the wait for this client's turn to have arrived.
 */
export const commitMove = async (page: Page, move: DrivableMove): Promise<void> => {
  if (move.kind === 'place') {
    // Both hands are on screen and only the side to move has enabled slots, so
    // the type alone does not identify the button.
    await page.locator(`button[aria-label^="${move.piece.type},"]:not([disabled])`).click();
  } else {
    await clickCell(page, move.from);
  }

  // A target sits above the tile it covers, so a beetle's landing cell reads as
  // a target rather than as the piece it is about to climb.
  await expect.poll(() => hitAt(page, move.to)).toBe('target');
  await clickCell(page, move.to);
};
