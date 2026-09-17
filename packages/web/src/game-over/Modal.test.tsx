// @vitest-environment jsdom

import { type GameState, LADYBUG_RULESET, createGame, resign } from '@termitary/engine';
import type { OpponentPresence } from '@termitary/protocol';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it } from 'vitest';
import { RoomProvider } from '../controller/RoomContext.js';
import { gameStore } from '../store/store.js';
import { Modal } from './Modal.js';

const OPPONENT: OpponentPresence = {
  status: 'connected',
  userId: 'u2',
  name: 'Amber Beetle',
};

const show = (myColor: 'white' | 'black' | null, opponent: OpponentPresence = OPPONENT) =>
  render(
    <MemoryRouter>
      <RoomProvider myColor={myColor} opponent={opponent}>
        <Modal />
      </RoomProvider>
    </MemoryRouter>,
  );

// act(): the store is module-level zustand, so a push from outside React has
// to be flushed before the assertion reads the DOM.
const load = (game: GameState): void => {
  act(() => {
    gameStore.getState().applyGameState(game);
  });
};

const resigned = (): GameState => resign(createGame(), 'white');

describe('game-over Modal', () => {
  afterEach(() => {
    cleanup();
    gameStore.getState().reset();
  });

  it('names the player who resigned', () => {
    load(resigned());
    show('black');

    expect(screen.getByText('White resigned')).toBeDefined();
  });

  it('names you as the winner rather than your colour', () => {
    load(resigned());
    show('black');

    expect(screen.getByText('You win')).toBeDefined();
  });

  it('links the winning opponent to their profile', () => {
    load(resigned());
    show('white');

    const link = screen.getByText('Amber Beetle');
    expect(link.getAttribute('href')).toBe('/u/u2');
  });

  it('keeps colours in hot-seat, where neither seat is yours', () => {
    load(resigned());
    show(null, { status: 'empty' });

    expect(screen.getByText('Black wins')).toBeDefined();
  });

  it('names the surrounded queen when the game ended on the board', () => {
    load({
      ...createGame(),
      status: 'finished',
      result: 'white-wins',
      endReason: 'queen-surrounded',
    });
    show('white');

    expect(screen.getByText('Black queen surrounded')).toBeDefined();
  });

  it('stays dismissed when the same finished game is re-delivered', () => {
    load(resigned());
    show('black');

    expect(screen.getByText('You win')).toBeDefined();
    fireEvent.click(screen.getByText('Review board'));
    expect(screen.queryByText('You win')).toBeNull();

    // What a reconnect does: the same result arrives as a fresh object.
    load(resigned());
    expect(screen.queryByText('You win')).toBeNull();
  });

  it('reopens for the next game once one starts', () => {
    load(resigned());
    show(null);

    fireEvent.click(screen.getByText('Review board'));
    load(createGame());
    load(resigned());

    expect(screen.getByText('Black wins')).toBeDefined();
  });

  it('deals the next hot-seat game the pieces the last one used', () => {
    load(resign(createGame(LADYBUG_RULESET), 'white'));
    show(null);

    fireEvent.click(screen.getByText('New game'));

    const { liveGame } = gameStore.getState();
    expect(liveGame.status).toBe('in_progress');
    expect(liveGame.ruleset).toEqual(LADYBUG_RULESET);
  });

  it('offers a new game in hot-seat and the lobby in a room', () => {
    load(resigned());
    show(null);
    expect(screen.getByText('New game')).toBeDefined();
    cleanup();

    load(resigned());
    show('black');
    expect(screen.getByText('Back to lobby')).toBeDefined();
  });
});
