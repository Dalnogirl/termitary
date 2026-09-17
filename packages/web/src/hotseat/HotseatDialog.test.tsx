// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prefsStore } from '../store/prefs.js';
import { HotseatDialog } from './HotseatDialog.js';

afterEach(cleanup);

// The prefs store is module-level, so the remembered picks outlive a render.
// The chunky set measures its glyphs with getBBox, which jsdom does not
// implement and which throws; letters only fails soft.
beforeEach(() => {
  localStorage.clear();
  prefsStore.setState({ expansions: [] });
  prefsStore.getState().setPieceSet('letters');
});

const openDialog = () => {
  const onStart = vi.fn();
  render(<HotseatDialog onStart={onStart} />);
  fireEvent.click(screen.getByRole('button', { name: 'New game' }));
  return onStart;
};

describe('HotseatDialog', () => {
  it('is open on arrival, so the route asks before it deals', () => {
    render(<HotseatDialog defaultOpen onStart={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Start game' })).toBeDefined();
  });

  it('stays shut until the trigger is used', () => {
    render(<HotseatDialog onStart={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Start game' })).toBeNull();
  });

  it('starts a base game when nothing is ticked', () => {
    const onStart = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    expect(onStart).toHaveBeenCalledWith([]);
  });

  it('starts with the pieces that were ticked', () => {
    const onStart = openDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ladybug/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Mosquito/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    expect(onStart).toHaveBeenCalledWith(['ladybug', 'mosquito']);
  });

  it('offers no seat: hot-seat plays both colours', () => {
    openDialog();
    expect(screen.queryByRole('radio')).toBeNull();
  });

  it('remembers the pieces, and opens on them next time', () => {
    openDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: /Mosquito/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    expect(prefsStore.getState().expansions).toEqual(['mosquito']);

    cleanup();
    const onStart = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    expect(onStart).toHaveBeenCalledWith(['mosquito']);
  });

  it('shares the remembered pieces with the room dialog', () => {
    prefsStore.setState({ expansions: ['ladybug'] });
    const onStart = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    expect(onStart).toHaveBeenCalledWith(['ladybug']);
  });

  it('closes once a game has started', () => {
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));
    expect(screen.queryByRole('button', { name: 'Start game' })).toBeNull();
  });
});
