// @vitest-environment jsdom

import { BASE_RULESET } from '@termitary/engine';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { prefsStore } from '../store/prefs.js';
import { CreateRoomDialog } from './CreateRoomDialog.js';

afterEach(cleanup);

// The prefs store is module-level, so the remembered picks outlive a render.
// The chunky set measures its glyphs with getBBox, which jsdom does not
// implement and which throws; letters only fails soft.
beforeEach(() => {
  localStorage.clear();
  prefsStore.setState({ expansions: [] });
  prefsStore.getState().setPieceSet('letters');
});

const openDialog = (isPending = false, created = true) => {
  const onCreate = vi.fn(async () => Promise.resolve(created));
  render(
    <CreateRoomDialog triggerLabel="Create new game" isPending={isPending} onCreate={onCreate} />,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Create new game' }));
  return onCreate;
};

describe('CreateRoomDialog', () => {
  it('creates with a random seat unless another is picked', () => {
    const onCreate = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    expect(onCreate).toHaveBeenCalledWith({ seat: 'random' });
  });

  it('sends the seat the creator picked', () => {
    const onCreate = openDialog();
    fireEvent.click(screen.getByRole('radio', { name: /Black/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    expect(onCreate).toHaveBeenCalledWith({ seat: 'black' });
  });

  it('stays open when the create fails, with the picked seat intact', async () => {
    const onCreate = openDialog(false, false);
    fireEvent.click(screen.getByRole('radio', { name: /Black/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    await vi.waitFor(() => expect(onCreate).toHaveBeenCalledWith({ seat: 'black' }));
    expect((screen.getByRole('radio', { name: /Black/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('closes once the create succeeds', async () => {
    openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Create game' })).toBeNull(),
    );
  });

  it('sends the expansion pieces the creator ticked, on top of base', () => {
    const onCreate = openDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ladybug/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    expect(onCreate).toHaveBeenCalledWith({
      seat: 'random',
      ruleset: { pieces: { ...BASE_RULESET.pieces, ladybug: 1 } },
    });
  });

  it('sends no ruleset at all for a base game', () => {
    const onCreate = openDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: /Mosquito/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Mosquito/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    expect(onCreate).toHaveBeenCalledWith({ seat: 'random' });
  });

  it('remembers the pieces once the create succeeds, and not before', async () => {
    const failing = openDialog(false, false);
    fireEvent.click(screen.getByRole('checkbox', { name: /Ladybug/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    await vi.waitFor(() => expect(failing).toHaveBeenCalled());
    await Promise.resolve();
    expect(prefsStore.getState().expansions).toEqual([]);

    cleanup();
    openDialog();
    fireEvent.click(screen.getByRole('checkbox', { name: /Ladybug/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    await vi.waitFor(() => expect(prefsStore.getState().expansions).toEqual(['ladybug']));
  });

  it('opens on the pieces picked last time', () => {
    prefsStore.setState({ expansions: ['mosquito'] });
    const onCreate = openDialog();
    fireEvent.click(screen.getByRole('button', { name: 'Create game' }));
    expect(onCreate).toHaveBeenCalledWith({
      seat: 'random',
      ruleset: { pieces: { ...BASE_RULESET.pieces, mosquito: 1 } },
    });
  });

  it('disables the submit while a create is in flight', () => {
    openDialog(true);
    expect(screen.getByRole('button', { name: 'Creating…' })).toHaveProperty('disabled', true);
  });
});
