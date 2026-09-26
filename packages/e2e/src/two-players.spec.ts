import { type Page, expect, test } from '@playwright/test';
import { occupiedCells, replayFrames } from '@termitary/engine';
import { SURROUND_GAME } from '@termitary/engine/testing';
import { signedInPlayer } from './support/auth.js';
import { commitMove, drawnAt, drivable, expectPieceAt } from './support/play.js';

// Every move with the piece the board should be showing where it landed, so a
// climb is asserted as the beetle rather than as the ant underneath it.
const script = (() => {
  const frames = replayFrames(SURROUND_GAME.moves, SURROUND_GAME.ruleset);
  return SURROUND_GAME.moves.map((move, index) => {
    const after = frames[index + 1];
    if (after === undefined) throw new Error('the fixture is longer than its own replay');
    const played = drivable(move);
    return { move: played, landed: drawnAt(after.board, played.to) };
  });
})();

const stackedCell = (() => {
  for (const [coord, stack] of occupiedCells(SURROUND_GAME.final.board)) {
    if (stack.length > 1) return coord;
  }
  throw new Error('the fixture ends with nothing stacked');
})();

// Both players take the default seek, which pairs into the base game the
// fixture was played under.
const pair = async (seeker: Page, joiner: Page): Promise<void> => {
  await seeker.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(seeker.getByRole('listitem').filter({ hasText: 'Your seek' })).toBeVisible();
  // A board with no seek of your own is read once, not polled.
  await joiner.reload();
  await joiner.getByRole('listitem').getByRole('button', { name: 'Join' }).click();
  await joiner.waitForURL('**/play/**');
  await seeker.waitForURL('**/play/**', { timeout: 15_000 });
};

// Seats are a coin flip. Only the side to move has an enabled hand, and the
// fixture opens with a placement, so that slot names white. Until the room
// answers, a page has no colour and plays both sides like hot-seat, so the
// count waits for Resign, which enables on the same answer.
const bySeat = async <T extends { page: Page }>(a: T, b: T): Promise<[white: T, black: T]> => {
  const opening = script[0]?.move;
  if (opening?.kind !== 'place') throw new Error('the fixture does not open with a placement');
  for (const { page } of [a, b]) {
    await expect(page.getByRole('button', { name: 'Resign' })).toBeEnabled();
  }
  const slot = (page: Page) =>
    page.locator(`button[aria-label^="${opening.piece.type},"]:not([disabled])`);
  const [inA, inB] = [await slot(a.page).count(), await slot(b.page).count()];
  expect(inA + inB).toBe(1);
  return inA === 1 ? [a, b] : [b, a];
};

test('two players play a game from the lobby to a surrounded queen', async ({ browser }) => {
  // 15 moves, each one a round trip through the server and back to both
  // canvases.
  test.slow();

  const stamp = Date.now();
  const seat = async (email: string) => ({ email, page: await signedInPlayer(browser, email) });
  const seeker = await seat(`seeker-${stamp}@test.dev`);
  const joiner = await seat(`joiner-${stamp}@test.dev`);

  await pair(seeker.page, joiner.page);
  const [{ page: white }, { page: black, email: blackEmail }] = await bySeat(seeker, joiner);

  for (const [index, { move, landed }] of script.entries()) {
    const mover = index % 2 === 0 ? white : black;
    const waiting = index % 2 === 0 ? black : white;
    await commitMove(mover, move);
    await expectPieceAt(mover, move.to, landed);
    // The opponent's board catching up is also this loop's turn signal: the
    // next move is committed on the page that has just drawn this one.
    await expectPieceAt(waiting, move.to, landed);
  }

  // The stack is still a stack once the dust settles, and reads as its top
  // piece from both sides.
  const onTop = drawnAt(SURROUND_GAME.final.board, stackedCell);
  await expectPieceAt(white, stackedCell, onTop);
  await expectPieceAt(black, stackedCell, onTop);

  await expect(white.getByRole('alertdialog')).toContainText('Black queen surrounded');
  await expect(white.getByRole('alertdialog')).toContainText('You win');
  await expect(black.getByRole('alertdialog')).toContainText('Black queen surrounded');
  // The loser's title names the winner, whose generated profile name black has
  // never been told any other way.
  await expect(black.getByRole('alertdialog').getByRole('link')).toHaveText(/^[a-z]+-[a-z]+$/);

  await black.getByRole('button', { name: 'Back to lobby' }).click();
  await black.getByRole('link', { name: blackEmail }).click();

  await expect(
    black.getByRole('listitem').filter({ hasText: 'Lost, queen surrounded' }),
  ).toContainText(`playing black · ${SURROUND_GAME.moves.length} moves`);
});
