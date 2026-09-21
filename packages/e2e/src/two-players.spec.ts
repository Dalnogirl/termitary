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

const openRoom = async (page: Page): Promise<string> => {
  await page.getByRole('button', { name: 'Create new game' }).click();
  await page.locator('label', { has: page.getByRole('radio', { name: /White/ }) }).click();
  await page.getByRole('button', { name: 'Create game' }).click();
  await page.waitForURL('**/play/**');
  return page.url();
};

test('two players play a game from the lobby to a surrounded queen', async ({ browser }) => {
  // 15 moves, each one a round trip through the server and back to both
  // canvases.
  test.slow();

  const stamp = Date.now();
  const white = await signedInPlayer(browser, `white-${stamp}@test.dev`);
  const black = await signedInPlayer(browser, `black-${stamp}@test.dev`);

  await black.goto(await openRoom(white));
  // Seated rather than merely looking: the empty seat is what white was told
  // about, so white's side is where it stops being empty.
  await expect(white.getByText('Waiting for opponent…')).toBeHidden();

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
  await black.getByRole('link', { name: `black-${stamp}@test.dev` }).click();

  await expect(
    black.getByRole('listitem').filter({ hasText: 'Lost, queen surrounded' }),
  ).toContainText(`playing black · ${SURROUND_GAME.moves.length} moves`);
});
