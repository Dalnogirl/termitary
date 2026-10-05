// @vitest-environment jsdom

import { type GameState, applyMove, createGame, resign } from '@termitary/engine';
import { BEFORE_SQUEEZE, SQUEEZE } from '@termitary/engine/testing';
import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomProvider } from '../controller/RoomContext.js';
import { gameStore } from '../store/store.js';
import { usePassToast } from './use-pass-toast.js';

const { info } = vi.hoisted(() => ({ info: vi.fn() }));
vi.mock('../lib/notify.js', () => ({ notifier: { info, error: vi.fn() } }));

const beforeSqueeze = (): GameState => BEFORE_SQUEEZE.reduce(applyMove, createGame());

const mount = (myColor: 'white' | 'black' | null) =>
  renderHook(usePassToast, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <RoomProvider
        myColor={myColor}
        opponent={{ status: 'connected', userId: 'u2', name: 'Amber Beetle' }}
      >
        {children}
      </RoomProvider>
    ),
  });

const load = (game: GameState): void => {
  act(() => {
    gameStore.getState().applyGameState(game);
  });
};

const squeezeWhite = (): void => {
  load(beforeSqueeze());
  load(applyMove(beforeSqueeze(), SQUEEZE));
};

describe('usePassToast', () => {
  beforeEach(() => info.mockClear());
  afterEach(() => {
    cleanup();
    gameStore.getState().reset();
  });

  it('tells you when your turn was passed', () => {
    mount('white');
    squeezeWhite();

    expect(info).toHaveBeenCalledWith(
      'You had no legal move',
      expect.objectContaining({ description: 'The turn passed, so Amber Beetle moves again.' }),
    );
  });

  it('stays quiet when it was the opponent who passed', () => {
    mount('black');
    squeezeWhite();

    expect(info).not.toHaveBeenCalled();
  });

  it('names the colours in hot-seat', () => {
    mount(null);
    squeezeWhite();

    expect(info).toHaveBeenCalledWith(
      'White had no legal move',
      expect.objectContaining({ description: 'The turn passed, so Black moves again.' }),
    );
  });

  it('stays quiet for a pass that was already there when the game loaded', () => {
    mount('white');
    load(applyMove(beforeSqueeze(), SQUEEZE));

    expect(info).not.toHaveBeenCalled();
  });

  it('stays quiet when the game is already over', () => {
    mount('white');
    load(beforeSqueeze());
    load(resign(applyMove(beforeSqueeze(), SQUEEZE), 'black'));

    expect(info).not.toHaveBeenCalled();
  });

  it('opens the passing rules in a new tab, so the game keeps its board', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null);
    mount('white');
    squeezeWhite();

    info.mock.calls[0]?.[1].action.onClick();

    expect(open).toHaveBeenCalledWith('/rules#passing', '_blank', 'noreferrer');
  });
});
