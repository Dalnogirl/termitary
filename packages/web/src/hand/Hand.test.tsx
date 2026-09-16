// @vitest-environment jsdom
import { type Ruleset, createGame } from '@termitary/engine';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { InputProvider } from '../controller/InputProvider.js';
import { RoomProvider } from '../controller/RoomContext.js';
import { prefsStore } from '../store/prefs.js';
import { gameStore } from '../store/store.js';
import { Hand } from './Hand.js';

const renderHand = (ruleset: Ruleset) => {
  // The chunky set measures its glyphs with getBBox, which jsdom does not
  // implement and which throws. Letters only fails soft.
  prefsStore.getState().setPieceSet('letters');
  gameStore.getState().applyGameState(createGame(ruleset));
  return render(
    <RoomProvider myColor={null}>
      <InputProvider controller={{ commitMove: () => {} }}>
        <Hand color="white" edge="bottom" />
      </InputProvider>
    </RoomProvider>,
  );
};

const slotNames = (): readonly string[] =>
  screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? '');

afterEach(() => {
  cleanup();
  gameStore.getState().reset();
});

describe('Hand', () => {
  it('renders one slot per type in the ruleset, queen first, whatever order it was built in', () => {
    renderHand({ pieces: { grasshopper: 3, spider: 2, beetle: 2, ant: 3, queen: 1 } });
    expect(slotNames()).toEqual([
      'queen, 1 in hand',
      'ant, 3 in hand',
      'beetle, 2 in hand',
      'spider, 2 in hand',
      'grasshopper, 3 in hand',
    ]);
  });

  it('leaves out a type the ruleset omits', () => {
    renderHand({ pieces: { queen: 1, ant: 3, beetle: 2, grasshopper: 3 } });
    expect(slotNames()).toEqual([
      'queen, 1 in hand',
      'ant, 3 in hand',
      'beetle, 2 in hand',
      'grasshopper, 3 in hand',
    ]);
  });
});
